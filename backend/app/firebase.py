"""
Firebase Admin SDK initialization and helpers.

In production, set FIREBASE_SERVICE_ACCOUNT_PATH env var to the path of
your Firebase service account JSON file. The file is gitignored.

If the service account file is missing, Firebase features are disabled
gracefully — the app still starts, but phone auth endpoints will return
503 Service Unavailable.
"""

import base64
import os
import tempfile
from pathlib import Path

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

_initialized = False


def _resolve_service_account_path() -> str:
    """Return the filesystem path to a Firebase service account JSON.

    Production (Fly.io, GitHub Actions): expects FIREBASE_SERVICE_ACCOUNT_B64 —
    a base64-encoded blob of the JSON file — which is decoded to a temp file
    at startup.

    Development: falls back to FIREBASE_SERVICE_ACCOUNT_PATH env var, or the
    default `backend/firebase-service-account.json` on disk.
    """
    b64 = os.environ.get("FIREBASE_SERVICE_ACCOUNT_B64")
    if b64:
        try:
            raw = base64.b64decode(b64).decode("utf-8")
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False
            ) as f:
                f.write(raw)
                return f.name
        except Exception as exc:  # pragma: no cover
            print(f"[firebase] Failed to decode FIREBASE_SERVICE_ACCOUNT_B64: {exc}")
    return os.environ.get(
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        str(Path(__file__).resolve().parent.parent / "firebase-service-account.json"),
    )


SERVICE_ACCOUNT_PATH = _resolve_service_account_path()


def init_firebase() -> bool:
    """Initialize Firebase Admin SDK. Returns True if successful."""
    global _initialized
    if _initialized:
        return True
    if not Path(SERVICE_ACCOUNT_PATH).exists():
        print(
            f"[firebase] Service account not found at {SERVICE_ACCOUNT_PATH}. "
            "Phone auth will be unavailable. See README for setup instructions."
        )
        return False
    try:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
        _initialized = True
        print("[firebase] Initialized successfully.")
        return True
    except Exception as e:
        print(f"[firebase] Init failed: {e}")
        return False


def is_available() -> bool:
    return _initialized


def verify_firebase_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token from the client.
    Returns the decoded token dict with uid, phone_number, etc.
    Raises ValueError if Firebase is not initialized.
    Raises firebase_auth.InvalidIdTokenError if token is invalid.
    """
    if not _initialized:
        raise ValueError("Firebase not initialized")
    return firebase_auth.verify_id_token(id_token)
