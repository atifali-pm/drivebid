/**
 * Central emoji + label map for every supported service type. Extend
 * here; all ride cards pull from this helper instead of inlining ternaries.
 */
export const RIDE_TYPE_EMOJI: Record<string, string> = {
  car: "🚗",
  motorcycle: "🏍️",
  rickshaw: "🛺",
  van: "🚐",
  parcel: "📦",
  freight: "🚛",
  task: "🧰",
};

export function rideTypeIcon(t: string | null | undefined): string {
  if (!t) return "🚗";
  return RIDE_TYPE_EMOJI[t] ?? "🚗";
}

export function isCompositeService(t: string | null | undefined): boolean {
  return t === "parcel" || t === "freight" || t === "task";
}

export function rideTypeLabel(t: string | null | undefined): string {
  if (!t) return "Ride";
  const map: Record<string, string> = {
    car: "Ride",
    motorcycle: "Ride",
    rickshaw: "Ride",
    van: "Ride",
    parcel: "Parcel",
    freight: "Freight",
    task: "Task",
  };
  return map[t] ?? "Ride";
}
