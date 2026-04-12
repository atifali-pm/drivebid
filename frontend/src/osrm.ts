/**
 * Client for the public OSRM routing API. No API key required.
 * Used to get real driving distance + duration between two points,
 * which feeds into the fare estimator.
 *
 * Endpoint docs: https://project-osrm.org/docs/v5.24.0/api/
 */

export interface RouteEstimate {
  distanceKm: number;
  durationMin: number;
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<RouteEstimate | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=false&alternatives=false&steps=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    };
  } catch {
    return null;
  }
}
