import AsyncStorage from "@react-native-async-storage/async-storage";

// Change this to your machine's LAN IP when testing via Expo Go on a phone.
// "localhost" only works on emulator. On a physical device, use your
// computer's LAN IP, e.g. "http://192.168.1.42:8050"
export const API_BASE = "http://drivebid.local:8050";

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
  amount: number;
  eta_minutes: number;
  message: string;
  status: "pending" | "accepted" | "rejected";
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
  notes: string;
  status: RideStatus;
  accepted_bid_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  rider_to_driver_stars: number | null;
  rider_to_driver_comment: string | null;
  driver_to_rider_stars: number | null;
  driver_to_rider_comment: string | null;
  created_at: string;
  bids: Bid[];
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
    notes?: string;
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
};
