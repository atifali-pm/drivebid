/**
 * Fare estimation for DriveBid, calibrated for PKR/Islamabad.
 *
 *   fare = max( MIN_FARE, BASE + (distance_km * PER_KM) + (duration_min * PER_MIN) )
 *
 * Rounded to the nearest 10 PKR for clean display.
 */

export const PRICING = {
  baseFare: 100, // PKR - fixed boarding fee
  perKm: 35, // PKR per km of driving
  perMinute: 5, // PKR per minute of travel (traffic penalty)
  minFare: 150, // PKR - absolute floor
  currencySymbol: "Rs",
};

export function estimateFare(distanceKm: number, durationMin: number): number {
  const raw =
    PRICING.baseFare +
    distanceKm * PRICING.perKm +
    durationMin * PRICING.perMinute;
  const clamped = Math.max(PRICING.minFare, raw);
  return Math.round(clamped / 10) * 10;
}

export function formatMoney(amount: number): string {
  return `${PRICING.currencySymbol} ${Math.round(amount).toLocaleString("en-PK")}`;
}

export function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
