const API_BASE = "http://drivebid.local:8050";

export type UserRole = "rider" | "driver" | "admin";

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

export type RideStatus =
  | "open"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

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

function getToken(): string | null {
  return localStorage.getItem("drivebid_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
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
    request<Ride>("/rides", {
      method: "POST",
      body: JSON.stringify(data),
    }),

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

  // Admin
  adminStats: () => request<AdminStats>("/admin/stats"),
  adminUsers: () => request<User[]>("/admin/users"),
  adminRides: () => request<Ride[]>("/admin/rides"),
};

export interface AdminStats {
  users: { total: number; riders: number; drivers: number };
  rides: { total: number; open: number; active: number; completed: number; cancelled: number };
  bids: { total: number };
  revenue: { total: number };
}
