export const PRICING = {
  baseFare: 100,
  perKm: 35,
  perMinute: 5,
  minFare: 150,
  currencySymbol: "Rs",
};

export function estimateFare(distanceKm: number, durationMin: number): number {
  const raw =
    PRICING.baseFare +
    distanceKm * PRICING.perKm +
    durationMin * PRICING.perMinute;
  return Math.round(Math.max(PRICING.minFare, raw) / 10) * 10;
}

export function formatMoney(amount: number): string {
  return `${PRICING.currencySymbol} ${Math.round(amount).toLocaleString()}`;
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
