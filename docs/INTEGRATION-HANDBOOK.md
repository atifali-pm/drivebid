# DriveBid integration handbook

Zero-to-production deploy for DriveBid. FastAPI backend + React SPA frontend + two Expo mobile apps (rider + driver), hosted on free tiers only. Monthly cost target: **$0**.

This document is self-contained. A fresh Claude session with access to the `/home/atif/projects/drivebid` directory can follow it end to end without any other context.

---

## What DriveBid currently is

Single repo, four distinct surfaces:

```
drivebid/
├── backend/                 FastAPI + SQLAlchemy + JWT + Firebase Admin + WebSockets
│   ├── app/
│   │   ├── main.py          :8050, CORS for *.local + LAN, /ws endpoint
│   │   ├── auth.py          JWT with jose, bcrypt passwords
│   │   ├── config.py        pydantic BaseSettings, reads .env
│   │   ├── database.py      SQLAlchemy, sqlite:///./drivebid.db by default
│   │   ├── firebase.py      Firebase Admin SDK, loads service-account.json
│   │   ├── models.py / schemas.py
│   │   ├── pricing.py / push.py / ws.py
│   │   └── routers/         admin, auth, disputes, rides
│   ├── drivebid.db          SQLite (dev)
│   └── requirements.txt
├── frontend/                React 18 + Vite 5 + Tailwind
│   ├── src/
│   └── package.json
├── mobile/
│   ├── rider/               Expo app: slug "drivebid", package com.atifali.drivebid.rider
│   ├── driver/              Expo app
│   └── shared/              shared code between rider + driver
└── docs/
```

**Ports and hosts (dev):**
- Backend: `http://drivebid.local:8050` (via `/etc/hosts` mapping)
- Frontend: `http://drivebid.local:5173`
- Rider / Driver app: Metro on `:8081` pointing at backend via LAN IP

**What's missing for production:**
- Database: SQLite file won't survive serverless deploys. Migrate to Postgres.
- Backend host: need somewhere to run `uvicorn`.
- Frontend host: need static hosting.
- Secrets: Firebase service account, JWT secret, CORS config.
- Mobile API URL: currently LAN IP, needs production URL baked in.
- Mobile builds: currently requires EAS cloud or a local machine; we'll move to free GitHub Actions.

---

## Stack for production (all free tier, no expiry)

| Layer | Choice | Why | Free allowance |
|---|---|---|---|
| Backend host | **Fly.io** | Runs Docker, Python-native, WebSockets supported, has free tier | 3 shared-cpu-1x VMs at 256 MB each |
| Database | **Neon** | Postgres, auto-pause, generous free tier | 0.5 GB, branching, auto-scale-to-zero |
| Frontend host | **Vercel** (or Netlify) | Static Vite bundle, instant deploys | 100 GB bandwidth/mo |
| Object storage | **Cloudflare R2** (if needed) | KYC docs, ride photos | 10 GB storage, zero egress fees |
| Email | **Resend** | Transactional (password resets, etc) | 100/day, 3000/mo |
| Push notifications | **Firebase Cloud Messaging** | Already wired in backend | Free, unlimited |
| Maps | **Mapbox** or OpenStreetMap tiles | For ride tracking | Mapbox: 50k map loads/mo free |
| Android APK builds | **GitHub Actions + `eas build --local`** | No EAS cloud credits burned | Unlimited on public repos, 2000 min/mo on private |
| APK distribution | **GitHub Releases** | Stable URL, unlimited bandwidth | Free forever |
| Version control | **GitHub** | Already there | Public repo: everything free |

**Key fit notes:**
- Fly.io beats Vercel for FastAPI because Vercel's Python support is limited (no WebSockets, 10s function timeout). Fly runs real long-lived processes.
- Neon's Postgres dialect requires changing `drivebid.db` from SQLite to Postgres. SQLAlchemy abstracts this; only the `DATABASE_URL` string changes.
- Firebase Admin stays free for push notifications and phone auth.

---

## One-time machine setup

Only do these steps once per development machine. Reuse for every future project.

### Install CLIs

```bash
# Already have most likely: node, pnpm, git
pnpm add -g neonctl eas-cli
curl -L https://fly.io/install.sh | sh            # Fly.io
# GitHub CLI: follow https://cli.github.com for your OS
```

### Authenticate each

```bash
flyctl auth login                 # opens browser
neonctl auth                      # opens browser
gh auth login                     # pick GitHub.com, HTTPS, browser
eas login                         # opens browser, or set EXPO_TOKEN env var
```

Credentials saved at:
- `~/.fly/config.yml`
- `~/.neon/credentials.json`
- `~/.config/gh/hosts.yml`
- `~/.expo/state.json`

### Generate and save three access tokens

These are needed for CI automation (GitHub Actions needs them to deploy on your behalf).

1. **Expo access token** — https://expo.dev/settings/access-tokens → Create token → name `github-actions-drivebid` → copy
2. **Fly.io access token** — `flyctl auth token` in terminal → copy (long-lived)
3. **Neon API key** — https://console.neon.tech/app/settings/api-keys → Create API key → copy

Save the three tokens somewhere safe (password manager entry). You'll paste them into GitHub repo secrets in step 6 below.

### Firebase service account (if using push notifications)

DriveBid's backend initialises Firebase Admin with a service account JSON file. For CI, you need to base64-encode it and store as a secret.

```bash
cat backend/firebase-service-account.json | base64 -w0 > /tmp/firebase-sa.b64
```

Save the contents of `/tmp/firebase-sa.b64` as a GitHub secret named `FIREBASE_SERVICE_ACCOUNT_B64` in step 6.

---

## Step-by-step deploy

### Step 1: provision Neon Postgres

```bash
neonctl projects create --name drivebid --region-id aws-eu-central-1
```

Output includes the project ID and a connection string. Copy the connection string (it's only shown once with the password visible):

```
postgresql://neondb_owner:npg_XXX@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Save it for later. Do NOT commit.

### Step 2: convert the backend to Postgres

The existing `backend/app/database.py` and `backend/app/models.py` use SQLAlchemy, which abstracts the SQL dialect. The only thing that changes is the connection string.

**Required changes to requirements.txt:**

```diff
+ psycopg2-binary==2.9.10     # Postgres driver
```

**Required changes to database.py:**

Most of it stays the same. The `connect_args={"check_same_thread": False}` line is SQLite-specific — wrap it:

```python
# Only SQLite needs this; Postgres does not
is_sqlite = settings.database_url.startswith("sqlite")
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if is_sqlite else {},
)
```

**Required changes to config.py:**

Leave the SQLite default for dev, but the env var wins for production:

```python
class Settings(BaseSettings):
    database_url: str = "sqlite:///./drivebid.db"   # dev fallback only
    # ... rest unchanged
```

**Run migrations against Neon:**

DriveBid currently uses `Base.metadata.create_all(bind=engine)` in `main.py`, which creates tables on first boot. That works for SQLite but is risky in production (no migration history, no schema versioning). Two options:

- **Quick path (demo / portfolio):** keep `create_all`. On first Fly.io deploy, tables are auto-created in Neon. Works fine.
- **Proper path (real launch):** adopt Alembic for migrations. See "Production hardening" at the bottom.

For the demo, skip Alembic. The first app boot on Fly.io will create the schema.

### Step 3: containerise the backend for Fly.io

Fly.io deploys Docker containers. Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Firebase service account is injected at runtime via env var decoded to /tmp
EXPOSE 8050

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8050"]
```

And `backend/.dockerignore`:

```
__pycache__
*.pyc
.venv
drivebid.db
firebase-service-account.json
```

### Step 4: handle Firebase service account at runtime

On Fly.io you pass the JSON as a base64 env var, decode at startup. Update `backend/app/firebase.py`:

```python
import os, base64, json, tempfile

def _resolve_service_account_path() -> str:
    # Production: base64-encoded JSON in env var
    b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_B64")
    if b64:
        raw = base64.b64decode(b64).decode("utf-8")
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write(raw)
            return f.name
    # Dev: file path
    return os.environ.get(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        "backend/firebase-service-account.json",
    )

SERVICE_ACCOUNT_PATH = _resolve_service_account_path()
```

### Step 5: deploy the backend to Fly.io

```bash
cd backend
flyctl launch --name drivebid-api --region fra --no-deploy
```

This scaffolds `fly.toml`. Edit it to expose port 8050 and configure scaling:

```toml
app = "drivebid-api"
primary_region = "fra"

[build]

[http_service]
  internal_port = 8050
  force_https = true
  auto_stop_machines = "stop"        # Scale to zero when idle (saves free tier hours)
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "256mb"                   # Fits free tier
  cpu_kind = "shared"
  cpus = 1

[env]
  PORT = "8050"
```

Set secrets (same pattern for every secret):

```bash
flyctl secrets set DATABASE_URL='<neon-connection-string>' \
  --app drivebid-api

flyctl secrets set JWT_SECRET="$(openssl rand -base64 32)" \
  --app drivebid-api

flyctl secrets set FIREBASE_SERVICE_ACCOUNT_B64="$(cat /tmp/firebase-sa.b64)" \
  --app drivebid-api

# Any other env vars the backend expects
```

Deploy:

```bash
flyctl deploy --app drivebid-api
```

Takes ~2 minutes. Output includes the public URL: `https://drivebid-api.fly.dev`.

Verify: `curl https://drivebid-api.fly.dev/health` should return `{"status": "ok", "service": "drivebid"}`.

### Step 6: tighten CORS for production

Edit `backend/app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://drivebid.vercel.app",           # your production frontend
        "http://localhost:5173",                  # dev
        "http://drivebid.local:5173",             # dev LAN
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

Redeploy: `flyctl deploy --app drivebid-api`.

### Step 7: deploy the React frontend to Vercel

Frontend is a static Vite bundle, trivial to host.

```bash
cd frontend
npm install -g vercel
vercel link --yes               # creates a Vercel project named after directory
```

Set the one env var the frontend needs (the backend URL):

```bash
vercel env add VITE_API_BASE_URL production <<< "https://drivebid-api.fly.dev"
vercel env add VITE_API_BASE_URL preview    <<< "https://drivebid-api.fly.dev"
```

**In the frontend code**, make sure `src/api.ts` (or equivalent) reads from `import.meta.env.VITE_API_BASE_URL`. If not already, refactor:

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://drivebid.local:8050";
```

Deploy:

```bash
vercel deploy --prod --yes
```

Output gives the production URL (e.g., `drivebid.vercel.app`). Add this URL to the CORS list in backend step 6 if it differs from what you guessed, and redeploy backend.

### Step 8: prepare the two mobile apps for production

Both `mobile/rider` and `mobile/driver` need identical treatment. Steps are the same; repeat for each.

**8a. Convert `app.json` to `app.config.ts`:**

Delete `mobile/rider/app.json`. Create `mobile/rider/app.config.ts`:

```ts
import { ExpoConfig, ConfigContext } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: "DriveBid Rider",
  slug: "drivebid-rider",
  owner: "aatifali",
  version: "1.0.0",
  scheme: "drivebid-rider",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.atifali.drivebid.rider",
  },
  android: {
    package: "com.atifali.drivebid.rider",
    versionCode: 4,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "INTERNET",
      "ACCESS_NETWORK_STATE",
    ],
  },
  updates: { enabled: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://drivebid.local:8050",
    wsUrl: process.env.EXPO_PUBLIC_WS_URL ?? "ws://drivebid.local:8050/ws",
    eas: {
      projectId: "<FILLED-BY-eas-init>",
    },
  },
});
```

Same pattern for `mobile/driver/app.config.ts` (change name, slug, scheme, package).

**8b. Read apiUrl from config in `src/api.ts`:**

```ts
import Constants from "expo-constants";

function resolveApiUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  if (extra?.apiUrl && !extra.apiUrl.includes("localhost") && !extra.apiUrl.includes(".local")) {
    return extra.apiUrl;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (hostUri) return `http://${hostUri.split(":")[0]}:8050`;
  return "http://localhost:8050";
}

export const API_BASE = resolveApiUrl();
```

Mirror for WebSocket URL if any ride tracking uses `/ws`.

**8c. Initialise EAS project for each app:**

```bash
cd mobile/rider
eas init --non-interactive
# Writes the generated projectId into app.config.ts's extra.eas.projectId
cd ../driver
eas init --non-interactive
```

Each app gets a separate EAS project (separate build queue, separate credentials).

**8d. Set up `eas.json` preview profile that produces APKs:**

Both apps should have:

```json
{
  "cli": {
    "version": ">= 15.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Step 9: add GitHub Actions APK workflow (one per mobile app)

Create `.github/workflows/android-apk-rider.yml`:

```yaml
name: Build Rider Android APK

on:
  workflow_dispatch:
    inputs:
      profile:
        description: "EAS profile (preview or production)"
        default: "preview"
        type: choice
        options: [preview, production]
  push:
    branches: [main]
    paths:
      - "mobile/rider/**"
      - "mobile/shared/**"
      - ".github/workflows/android-apk-rider.yml"

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    env:
      PROFILE: ${{ github.event.inputs.profile || 'preview' }}
      EXPO_PUBLIC_API_URL: ${{ vars.EXPO_PUBLIC_API_URL }}
      EXPO_PUBLIC_WS_URL: ${{ vars.EXPO_PUBLIC_WS_URL }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "17"

      - uses: android-actions/setup-android@v3

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm

      - name: Install deps
        working-directory: mobile/rider
        run: pnpm install --frozen-lockfile

      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        working-directory: mobile/rider
        run: |
          eas build --platform android --profile "$PROFILE" --local \
            --non-interactive --output "../../drivebid-rider-${PROFILE}.apk"

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: drivebid-rider-${{ env.PROFILE }}
          path: drivebid-rider-*.apk

      - name: Refresh `rider-android-latest` release
        if: github.ref == 'refs/heads/main'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: rider-android-latest
          name: Rider Android (latest)
          files: drivebid-rider-*.apk
          body: |
            Built from commit ${{ github.sha }} on `main`.
          generate_release_notes: false
          make_latest: "true"
```

Mirror the file to `.github/workflows/android-apk-driver.yml` with `driver` substituted and the tag name `driver-android-latest`.

### Step 10: wire GitHub secrets and variables

```bash
# Expo access token (from one-time setup)
gh secret set EXPO_TOKEN --repo <owner>/drivebid --body 'expo-token-value'

# Fly.io deploy token (for optional backend CD workflow)
gh secret set FLY_API_TOKEN --repo <owner>/drivebid --body 'flyctl-auth-token-value'

# Firebase service account (base64)
gh secret set FIREBASE_SERVICE_ACCOUNT_B64 --repo <owner>/drivebid \
  --body "$(cat /tmp/firebase-sa.b64)"

# Production API URL (the Fly.io app URL)
gh variable set EXPO_PUBLIC_API_URL --repo <owner>/drivebid \
  --body "https://drivebid-api.fly.dev"

# WebSocket URL
gh variable set EXPO_PUBLIC_WS_URL --repo <owner>/drivebid \
  --body "wss://drivebid-api.fly.dev/ws"
```

### Step 11: trigger first APK builds

```bash
gh workflow run android-apk-rider.yml --repo <owner>/drivebid
gh workflow run android-apk-driver.yml --repo <owner>/drivebid
```

Or push a commit to `main`. Both workflows run in parallel on separate runners.

Each takes ~25 minutes. Lands as two separate releases:
- `https://github.com/<owner>/drivebid/releases/tag/rider-android-latest`
- `https://github.com/<owner>/drivebid/releases/tag/driver-android-latest`

### Step 12: optional — backend CD via GitHub Actions

If you want `git push` to deploy the backend automatically, add `.github/workflows/backend-deploy.yml`:

```yaml
name: Deploy backend to Fly.io

on:
  push:
    branches: [main]
    paths:
      - "backend/**"
      - ".github/workflows/backend-deploy.yml"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only --app drivebid-api
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## Verification checklist

### Backend
- [ ] `curl https://drivebid-api.fly.dev/health` returns `{"status":"ok"}`
- [ ] `curl https://drivebid-api.fly.dev/docs` renders FastAPI's Swagger UI
- [ ] Neon dashboard shows tables created (users, rides, etc.)
- [ ] Login via `POST /auth/login` with a seeded user returns a JWT

### Frontend
- [ ] `https://drivebid.vercel.app` loads without console errors
- [ ] Login flow on web works end-to-end
- [ ] Browser DevTools Network tab shows requests going to `drivebid-api.fly.dev`

### Mobile
- [ ] Both APKs downloadable from GitHub Releases
- [ ] Installs on Android phone
- [ ] Phone auth flow succeeds (Firebase SMS OTP delivers)
- [ ] Rider can request a ride, Driver receives the WebSocket event
- [ ] Ride tracking updates in real time on both apps

### Infrastructure
- [ ] Fly.io dashboard shows `drivebid-api` running in Frankfurt
- [ ] Neon shows auto-pause when idle (saves free tier)
- [ ] GitHub Actions runs are green on every push

---

## Troubleshooting

### Backend

**Fly deploy fails: "no Dockerfile found"**
Run `flyctl deploy` from `backend/` directory. Or set `dockerfile = "Dockerfile"` in `fly.toml`.

**Fly deploy fails with psycopg2 build error**
Dockerfile must install `libpq-dev` and `gcc` before `pip install`. See Step 3.

**App boots but 500s on every request with `no such table: users`**
`Base.metadata.create_all(bind=engine)` runs on app startup; if it failed to reach the DB, no tables. Check `DATABASE_URL` secret is set: `flyctl secrets list --app drivebid-api`.

**WebSocket `/ws` connection fails**
Fly.io supports WebSockets natively on the same port. No extra config. Check the client is using `wss://` (not `ws://`) and includes the `?token=...` query param the server expects.

**Firebase init fails on Fly**
`FIREBASE_SERVICE_ACCOUNT_B64` secret is missing or malformed. Regenerate: `base64 -w0 backend/firebase-service-account.json`. Note the `-w0` (no line wrap) — without it, base64 adds newlines and decoding fails.

### Frontend

**Build succeeds but blank white page**
Vite needs the API URL at build time. Check the env var is set in Vercel and the code uses `import.meta.env.VITE_API_BASE_URL`.

**CORS errors on every API call**
Backend CORS list doesn't include the Vercel URL. Update Step 6 with the actual URL and redeploy backend.

### Mobile

**APK builds but "Network request failed"**
`EXPO_PUBLIC_API_URL` not set as a GitHub variable, or set to localhost. Set it to the Fly URL and trigger a fresh build.

**Maps/location don't work on the APK**
Android permissions are declared in `app.config.ts` but need to be granted at runtime by the user. Check the app requests permissions on first launch.

**SMS OTP never arrives**
Firebase phone auth on real devices requires SHA-1 fingerprint of your APK to be added to Firebase console. Get it from EAS:
```bash
cd mobile/rider
eas credentials     # shows the SHA-1
```
Add it at https://console.firebase.google.com → Project → Settings → General → Android app → SHA certificate fingerprints.

**Rider and driver APKs have same app ID**
They must differ. Check `android.package` in each `app.config.ts`:
- rider: `com.atifali.drivebid.rider`
- driver: `com.atifali.drivebid.driver`

---

## Production hardening (when you leave the demo phase)

### Replace `create_all` with Alembic migrations

```bash
cd backend
pip install alembic
alembic init alembic
# Edit alembic/env.py to import your SQLAlchemy Base
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Then in deploy pipeline: `alembic upgrade head` before starting uvicorn.

### Add rate limiting

FastAPI has no built-in rate limiting. Options:
- `slowapi` library (in-memory, simplest)
- Upstash Redis free tier + custom middleware (distributed)
- Cloudflare in front of Fly.io (WAF + rate limiting, free tier generous)

### Monitor for errors

- Sentry free tier: 5000 events/mo. Wire with `sentry-sdk[fastapi]`.
- Fly.io has basic logs in dashboard; stream to Axiom or Logtail for retention.

### Scale the Fly machine when you have users

Free tier is 256 MB RAM. When you exceed ~100 concurrent users, bump to `shared-cpu-1x@512mb` (~$2/month) or `shared-cpu-2x@1gb` (~$8/month).

### Custom domain

- Buy domain ($10/year)
- Fly.io: `flyctl certs add drivebid.com --app drivebid-api`
- Vercel: Settings → Domains → Add
- Update mobile `EXPO_PUBLIC_API_URL` variable to the custom domain, rebuild APKs

---

## Secrets inventory

Every production secret in one list so rotation and audit are easy.

### Fly.io secrets (on `drivebid-api` app)
- `DATABASE_URL` — Neon Postgres connection string
- `JWT_SECRET` — openssl rand -base64 32
- `FIREBASE_SERVICE_ACCOUNT_B64` — base64 of firebase-service-account.json
- Any third-party API keys (Stripe, Mapbox, etc.)

### Vercel env (on `drivebid-frontend` project)
- `VITE_API_BASE_URL` — Fly.io public URL

### GitHub secrets (on the `drivebid` repo)
- `EXPO_TOKEN` — Expo access token
- `FLY_API_TOKEN` — Fly.io CLI token (for backend CD workflow)
- `FIREBASE_SERVICE_ACCOUNT_B64` — same as Fly, for any CI that needs it

### GitHub variables (on the `drivebid` repo)
- `EXPO_PUBLIC_API_URL` — Fly.io public URL
- `EXPO_PUBLIC_WS_URL` — WebSocket URL

### Mobile app config (in each app.config.ts)
- `extra.eas.projectId` — written automatically by `eas init`

Rotate any of these by regenerating at the source (Neon, Fly, Firebase, GitHub, Expo dashboards) and updating the dependents. The web app, mobile app, and CI all read from the canonical source, so rotation is a dashboard click + a redeploy.

---

## Total cost audit

- Fly.io: $0 (within 3 shared VMs, 256 MB each)
- Neon: $0 (under 0.5 GB)
- Vercel: $0 (hobby tier static hosting)
- Firebase: $0 (push + phone auth well within free quotas)
- GitHub Actions: $0 (public repo) or $0 (private with 2000 min/mo, each build is ~25 min = ~80 builds/mo)
- GitHub Releases: $0
- Resend: $0 (if you add transactional email, 100/day free)

**Target monthly cost: $0.** You leave this zero zone when:
- Fly machine needs more than 256 MB RAM (start paying around $2-5/mo)
- Neon needs always-on compute or more than 0.5 GB (start paying $19/mo)
- You exceed 100 emails/day (Resend Pro starts at $20/mo)

None of those hit until you have real user traffic, and by then the project either pays for itself or the costs are justified.

---

## What to share with a fresh Claude session on DriveBid

Paste this entire document. Claude will have:

- Full inventory of the current state
- Exact stack decisions with rationale
- Every deploy step with commands
- Every file change with the full diff
- Verification steps
- Troubleshooting for every class of failure
- Hardening and cost notes

That session can execute the deploy end-to-end by following this document, the same way a fresh session on Zarpay can execute Zarpay's deploy by following `zarpay/docs/INTEGRATION-HANDBOOK.md`.

Pattern works for any future project: write one of these handbooks for each stack combination you repeat (Next.js+Vercel+Neon, FastAPI+Fly+Neon, etc.), and deploying becomes a paste-and-execute operation.
