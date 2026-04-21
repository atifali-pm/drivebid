import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Resolve API_BASE in this order:
// 1. EXPO_PUBLIC_API_URL / extra.apiUrl baked into the APK at build time (prod)
// 2. Metro hostUri (Expo Go) so the phone hits its dev laptop's LAN IP
// 3. Fallback to ngrok static domain
function resolveApiUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
  if (extra.apiUrl && !extra.apiUrl.includes("localhost") && !extra.apiUrl.includes(".local")) {
    return extra.apiUrl;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  if (hostUri) {
    const host = String(hostUri).split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:8050`;
    }
  }
  return "https://amusing-handcart-viewer.ngrok-free.dev";
}

export const API_BASE = resolveApiUrl();

export type UserRole = "rider" | "driver" | "admin";
export type RideStatus =
  | "open"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface Bid {
  id: number;
  ride_id: number;
  driver_id: number;
  driver_name: string | null;
  driver_phone: string | null;
  driver_vehicle_type: string | null;
  driver_vehicle_model: string | null;
  driver_vehicle_plate: string | null;
  driver_rating: number | null;
  driver_trip_count: number;
  driver_lat: number | null;
  driver_lng: number | null;
  amount: number;
  eta_minutes: number;
  message: string;
  status: "pending" | "accepted" | "rejected";
  pool_key: string | null;
  created_at: string;
}

export interface Ride {
  id: number;
  rider_id: number;
  rider_name: string | null;
  pickup: string;
  dropoff: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  distance_km: number | null;
  duration_min: number | null;
  estimated_fare: number | null;
  max_budget: number;
  ride_type: string;
  notes: string;
  pool_ok: boolean;
  status: RideStatus;
  accepted_bid_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  auction_ends_at: string | null;
  rider_to_driver_stars: number | null;
  rider_to_driver_comment: string | null;
  driver_to_rider_stars: number | null;
  driver_to_rider_comment: string | null;
  created_at: string;
  bids: Bid[];
}

export type DisputeCategory =
  | "driver_behavior"
  | "rider_behavior"
  | "route_issue"
  | "payment_issue"
  | "safety"
  | "other";

export interface Dispute {
  id: number;
  ride_id: number;
  user_id: number;
  category: string;
  description: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

const TOKEN_KEY = "drivebid_token";
const USER_KEY = "drivebid_user";

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function persistAuth(res: TokenResponse): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, res.access_token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  register: (data: {
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    phone?: string;
  }) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createRide: (data: {
    pickup: string;
    dropoff: string;
    pickup_lat?: number | null;
    pickup_lng?: number | null;
    dropoff_lat?: number | null;
    dropoff_lng?: number | null;
    distance_km?: number | null;
    duration_min?: number | null;
    estimated_fare?: number | null;
    max_budget: number;
    ride_type?: string;
    notes?: string;
    pool_ok?: boolean;
  }) =>
    request<Ride>("/rides", { method: "POST", body: JSON.stringify(data) }),

  listOpenRides: () => request<Ride[]>("/rides/open"),
  listMyRides: () => request<Ride[]>("/rides/mine"),
  getRide: (id: number) => request<Ride>(`/rides/${id}`),

  placeBid: (
    rideId: number,
    data: { amount: number; eta_minutes: number; message?: string }
  ) =>
    request<Bid>(`/rides/${rideId}/bids`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  acceptBid: (rideId: number, bidId: number) =>
    request<Ride>(`/rides/${rideId}/accept/${bidId}`, { method: "POST" }),

  startRide: (rideId: number) =>
    request<Ride>(`/rides/${rideId}/start`, { method: "POST" }),

  completeRide: (rideId: number) =>
    request<Ride>(`/rides/${rideId}/complete`, { method: "POST" }),

  cancelRide: (rideId: number) =>
    request<Ride>(`/rides/${rideId}/cancel`, { method: "POST" }),

  rateRide: (rideId: number, stars: number, comment: string) =>
    request<Ride>(`/rides/${rideId}/rate`, {
      method: "POST",
      body: JSON.stringify({ stars, comment }),
    }),

  createDispute: (data: {
    ride_id: number;
    category: DisputeCategory;
    description: string;
  }) =>
    request<Dispute>("/disputes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMyDisputes: () => request<Dispute[]>("/disputes/mine"),

  sendMessage: (rideId: number, content: string) =>
    request<{ id: number; content: string; sender_name: string; created_at: string }>(
      `/rides/${rideId}/messages`,
      { method: "POST", body: JSON.stringify({ content }) }
    ),

  listMessages: (rideId: number) =>
    request<
      { id: number; sender_id: number; sender_name: string; content: string; msg_type: string; created_at: string }[]
    >(`/rides/${rideId}/messages`),
};
