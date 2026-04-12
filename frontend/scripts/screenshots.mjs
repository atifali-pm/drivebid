#!/usr/bin/env node
/**
 * Generates README screenshots by driving headless Chrome through real
 * DriveBid flows. Registers fresh test users via the API, seeds the
 * exact state each screenshot needs, injects the JWT into localStorage,
 * and snaps the page.
 *
 * Usage:
 *   node scripts/screenshots.mjs
 *
 * Requires backend + frontend to be running on drivebid.local.
 */

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "http://drivebid.local:8050";
const FRONTEND = "http://drivebid.local:5173";
const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "docs",
  "screenshots"
);
const VIEWPORT = { width: 1440, height: 900 };
const CHROME = "/usr/bin/google-chrome";
const TS = Date.now();

const PICKUP = {
  lat: 33.6874892,
  lng: 73.0409191,
  label: "G-9/4, Islamabad, Pakistan",
  text: "G-9/4",
};
const DROPOFF = {
  lat: 33.5651,
  lng: 73.3265,
  label: "Islamabad International Airport, Pakistan",
  text: "Islamabad Airport",
};

// ---------- API helpers ----------

async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

function email(role, n) {
  return `shot-${role}-${TS}-${n}@test.example.com`;
}

async function registerUser(role, n, fullName) {
  return api("/auth/register", {
    method: "POST",
    body: {
      email: email(role, n),
      full_name: fullName,
      password: "secret123",
      role,
    },
  });
}

async function postRide(riderToken) {
  return api("/rides", {
    method: "POST",
    body: {
      pickup: PICKUP.label,
      dropoff: DROPOFF.label,
      pickup_lat: PICKUP.lat,
      pickup_lng: PICKUP.lng,
      dropoff_lat: DROPOFF.lat,
      dropoff_lng: DROPOFF.lng,
      distance_km: 42.3,
      duration_min: 38,
      estimated_fare: 1700,
      max_budget: 1700,
      notes: "2 bags, friendly driver please",
    },
    token: riderToken,
  });
}

async function placeBid(driverToken, rideId, amount, eta, message) {
  return api(`/rides/${rideId}/bids`, {
    method: "POST",
    body: { amount, eta_minutes: eta, message },
    token: driverToken,
  });
}

async function acceptBid(riderToken, rideId, bidId) {
  return api(`/rides/${rideId}/accept/${bidId}`, {
    method: "POST",
    token: riderToken,
  });
}

async function startRide(driverToken, rideId) {
  return api(`/rides/${rideId}/start`, { method: "POST", token: driverToken });
}

async function completeRide(driverToken, rideId) {
  return api(`/rides/${rideId}/complete`, {
    method: "POST",
    token: driverToken,
  });
}

// ---------- Playwright helpers ----------

async function freshPage(browser, auth) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  if (auth) {
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("drivebid_token", token);
        localStorage.setItem("drivebid_user", JSON.stringify(user));
      },
      { token: auth.access_token, user: auth.user }
    );
  }

  return { context, page };
}

async function waitForTilesToLoad(page) {
  // Leaflet tiles fade in; give them a moment after navigation settles.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

async function snap(page, name) {
  const path = resolve(OUT_DIR, name);
  await page.screenshot({ path, fullPage: false });
  console.log(`  -> ${name}`);
}

// ---------- Screenshot flows ----------

async function shotLogin(browser) {
  console.log("01-login.png");
  const { context, page } = await freshPage(browser, null);
  await page.goto(`${FRONTEND}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await snap(page, "01-login.png");
  await context.close();
}

async function shotRiderMapPicker(browser) {
  console.log("02-rider-map-picker.png");
  const rider = await registerUser("rider", "map", "Sara Ahmed");
  const { context, page } = await freshPage(browser, rider);

  // Log any console errors/warnings from the page for debugging.
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  page error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => console.log(`  page crash: ${err.message}`));

  await page.goto(FRONTEND, { waitUntil: "networkidle" });
  await waitForTilesToLoad(page);

  // Wait for the MapPicker search input to be fully mounted + interactive.
  const searchInput = page.getByPlaceholder(/search address/i);
  await searchInput.waitFor({ state: "visible", timeout: 5000 });
  await searchInput.click();
  await searchInput.fill(PICKUP.text);

  const value = await searchInput.inputValue();
  console.log(`  typed into search: "${value}"`);

  // Press Enter to submit (more reliable than clicking the button).
  await searchInput.press("Enter");

  // Wait explicitly for a list item from Photon results.
  try {
    await page.waitForFunction(
      () => document.querySelectorAll("ul li button").length >= 2,
      { timeout: 15000 }
    );
    console.log(`  results list populated`);
  } catch {
    const count = await page
      .locator("ul li button")
      .count()
      .catch(() => 0);
    console.log(`  no results after 15s (count=${count})`);
  }

  await page.waitForTimeout(600);
  await snap(page, "02-rider-map-picker.png");
  await context.close();
}

async function shotRiderLiveBids(browser) {
  console.log("03-rider-live-bids.png");
  const rider = await registerUser("rider", "bids", "Sara Ahmed");
  const d1 = await registerUser("driver", "bids-1", "Imran Khan");
  const d2 = await registerUser("driver", "bids-2", "Bilal Hussain");
  const d3 = await registerUser("driver", "bids-3", "Ahmed Raza");

  const ride = await postRide(rider.access_token);
  await placeBid(d1.access_token, ride.id, 1600, 8, "Corolla, AC");
  await placeBid(d2.access_token, ride.id, 1500, 12, "Civic, clean");
  await placeBid(d3.access_token, ride.id, 1650, 5, "Alto, closest");

  const { context, page } = await freshPage(browser, rider);
  await page.goto(FRONTEND, { waitUntil: "networkidle" });
  await waitForTilesToLoad(page);
  await snap(page, "03-rider-live-bids.png");
  await context.close();
}

async function shotDriverOpenRides(browser) {
  console.log("04-driver-open-rides.png");
  const rider = await registerUser("rider", "open", "Sara Ahmed");
  const driver = await registerUser("driver", "open", "Imran Khan");

  // Create a couple of open rides so the driver's dashboard has multiple cards.
  await postRide(rider.access_token);
  const rider2 = await registerUser("rider", "open-2", "Fatima Sheikh");
  await api("/rides", {
    method: "POST",
    token: rider2.access_token,
    body: {
      pickup: "F-7 Markaz, Islamabad",
      dropoff: "Centaurus Mall, Islamabad",
      pickup_lat: 33.7196,
      pickup_lng: 73.0571,
      dropoff_lat: 33.7077,
      dropoff_lng: 73.0499,
      distance_km: 3.2,
      duration_min: 8,
      estimated_fare: 350,
      max_budget: 350,
      notes: "",
    },
  });

  const { context, page } = await freshPage(browser, driver);
  await page.goto(FRONTEND, { waitUntil: "networkidle" });
  await waitForTilesToLoad(page);
  await snap(page, "04-driver-open-rides.png");
  await context.close();
}

async function shotTripInProgress(browser) {
  console.log("05-trip-in-progress.png");
  const rider = await registerUser("rider", "trip", "Sara Ahmed");
  const driver = await registerUser("driver", "trip", "Imran Khan");
  const ride = await postRide(rider.access_token);
  const bid = await placeBid(
    driver.access_token,
    ride.id,
    1600,
    7,
    "Corolla, AC, water available"
  );
  await acceptBid(rider.access_token, ride.id, bid.id);
  await startRide(driver.access_token, ride.id);

  const { context, page } = await freshPage(browser, rider);
  await page.goto(FRONTEND, { waitUntil: "networkidle" });
  await waitForTilesToLoad(page);
  await snap(page, "05-trip-in-progress.png");
  await context.close();
}

async function shotRating(browser) {
  console.log("06-rating.png");
  const rider = await registerUser("rider", "rate", "Sara Ahmed");
  const driver = await registerUser("driver", "rate", "Imran Khan");
  const ride = await postRide(rider.access_token);
  const bid = await placeBid(
    driver.access_token,
    ride.id,
    1600,
    7,
    "Corolla, AC"
  );
  await acceptBid(rider.access_token, ride.id, bid.id);
  await startRide(driver.access_token, ride.id);
  await completeRide(driver.access_token, ride.id);

  const { context, page } = await freshPage(browser, rider);
  await page.goto(FRONTEND, { waitUntil: "networkidle" });
  await waitForTilesToLoad(page);
  await snap(page, "06-rating.png");
  await context.close();
}

// ---------- main ----------

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Launching ${CHROME} headless...`);
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    await shotLogin(browser);
    await shotRiderMapPicker(browser);
    await shotRiderLiveBids(browser);
    await shotDriverOpenRides(browser);
    await shotTripInProgress(browser);
    await shotRating(browser);
  } finally {
    await browser.close();
  }

  console.log(`\nDone. Screenshots in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
