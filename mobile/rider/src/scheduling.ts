/**
 * Human-friendly "in 3h 20m" / "tomorrow 8:45" style label for a future
 * ISO timestamp. Returns null when the ride is immediate (not scheduled).
 */
export function formatScheduledFor(iso: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const now = Date.now();
  const diff = t - now;
  if (diff < 60_000) return "leaving now";

  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `in ${mins} min`;

  const hours = Math.floor(mins / 60);
  const leftover = mins % 60;
  if (hours < 12) {
    return leftover > 0 ? `in ${hours}h ${leftover}m` : `in ${hours}h`;
  }

  // Longer horizons: show the actual departure time, dropping seconds.
  const when = new Date(t);
  const sameDay =
    when.getDate() === new Date().getDate() &&
    when.getMonth() === new Date().getMonth();
  const hh = when.getHours();
  const mm = when.getMinutes().toString().padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return sameDay
    ? `today ${h12}:${mm} ${ampm}`
    : `tomorrow ${h12}:${mm} ${ampm}`;
}

export function isScheduled(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now() + 5 * 60_000;
}
