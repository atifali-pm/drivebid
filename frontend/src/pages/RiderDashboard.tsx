import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Ride, RideStatus } from "../api";
import StatusBadge from "../components/StatusBadge";
import RatingForm from "../components/RatingForm";
import MapPicker, { MapPickerValue } from "../components/MapPicker";
import MiniMap from "../components/MiniMap";

const EMPTY_LOCATION: MapPickerValue = {
  pickup: null,
  dropoff: null,
  pickupLabel: "",
  dropoffLabel: "",
};

export default function RiderDashboard() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [location, setLocation] = useState<MapPickerValue>(EMPTY_LOCATION);
  const [maxBudget, setMaxBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listMyRides();
      setRides(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rides");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!location.pickup || !location.dropoff) {
      setError("Pick both pickup and dropoff on the map");
      return;
    }
    setLoading(true);
    try {
      await api.createRide({
        pickup: location.pickupLabel,
        dropoff: location.dropoffLabel,
        pickup_lat: location.pickup.lat,
        pickup_lng: location.pickup.lng,
        dropoff_lat: location.dropoff.lat,
        dropoff_lng: location.dropoff.lng,
        max_budget: Number(maxBudget),
        notes,
      });
      setLocation(EMPTY_LOCATION);
      setMaxBudget("");
      setNotes("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ride");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(rideId: number, bidId: number) {
    try {
      await api.acceptBid(rideId, bidId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept bid");
    }
  }

  async function handleCancel(rideId: number) {
    try {
      await api.cancelRide(rideId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel ride");
    }
  }

  async function handleRate(rideId: number, stars: number, comment: string) {
    try {
      await api.rateRide(rideId, stars, comment);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <section className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-fit">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Post a ride request
        </h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <MapPicker value={location} onChange={setLocation} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Max budget
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              required
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="25.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Large luggage, 2 passengers..."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark text-white font-medium py-2 rounded-md disabled:opacity-60"
          >
            {loading ? "Posting..." : "Post ride"}
          </button>
        </form>
      </section>

      <section className="lg:col-span-3 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Your rides</h2>
        {rides.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500">
            No rides yet. Post one on the left.
          </div>
        )}
        {rides.map((ride) => (
          <RiderRideCard
            key={ride.id}
            ride={ride}
            onAccept={handleAccept}
            onCancel={handleCancel}
            onRate={handleRate}
          />
        ))}
      </section>
    </div>
  );
}

function RiderRideCard({
  ride,
  onAccept,
  onCancel,
  onRate,
}: {
  ride: Ride;
  onAccept: (rideId: number, bidId: number) => void;
  onCancel: (rideId: number) => void;
  onRate: (rideId: number, stars: number, comment: string) => void;
}) {
  const canCancel: RideStatus[] = ["open", "accepted"];
  const acceptedBid = ride.bids.find((b) => b.id === ride.accepted_bid_id);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-800">
            {ride.pickup} → {ride.dropoff}
          </p>
          <p className="text-sm text-slate-500">
            Max budget: ${ride.max_budget.toFixed(2)}
            {ride.notes && ` · ${ride.notes}`}
          </p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <MiniMap
        pickupLat={ride.pickup_lat}
        pickupLng={ride.pickup_lng}
        dropoffLat={ride.dropoff_lat}
        dropoffLng={ride.dropoff_lng}
      />

      {acceptedBid && ride.status !== "open" && (
        <div className="mb-3 p-3 rounded-lg bg-sky-50 border border-sky-200 text-sm">
          <p>
            <strong>{acceptedBid.driver_name}</strong> accepted · $
            {acceptedBid.amount.toFixed(2)} · ETA {acceptedBid.eta_minutes}m
          </p>
          {ride.status === "in_progress" && (
            <p className="text-xs text-sky-700 mt-1">Trip in progress...</p>
          )}
          {ride.status === "completed" && (
            <p className="text-xs text-sky-700 mt-1">Trip completed</p>
          )}
        </div>
      )}

      {ride.status === "open" && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500 uppercase mb-2">
            Driver bids ({ride.bids.length})
          </p>
          {ride.bids.length === 0 && (
            <p className="text-sm text-slate-500 italic">
              Waiting for drivers to bid...
            </p>
          )}
          <div className="space-y-2">
            {ride.bids
              .sort((a, b) => a.amount - b.amount)
              .map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {bid.driver_name ?? "Driver"} — ${bid.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      ETA {bid.eta_minutes} min
                      {bid.message && ` · ${bid.message}`}
                    </p>
                  </div>
                  <button
                    onClick={() => onAccept(ride.id, bid.id)}
                    className="text-sm bg-brand hover:bg-brand-dark text-white px-3 py-1.5 rounded-md"
                  >
                    Accept
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {ride.status === "completed" && ride.rider_to_driver_stars === null && (
        <RatingForm
          label={`Rate ${acceptedBid?.driver_name ?? "driver"}`}
          onSubmit={(stars, comment) => onRate(ride.id, stars, comment)}
        />
      )}

      {ride.status === "completed" && ride.rider_to_driver_stars !== null && (
        <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">
          You rated this trip {ride.rider_to_driver_stars}★
          {ride.rider_to_driver_comment && ` — "${ride.rider_to_driver_comment}"`}
        </div>
      )}

      {canCancel.includes(ride.status) && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onCancel(ride.id)}
            className="text-xs text-red-600 hover:underline"
          >
            Cancel ride
          </button>
        </div>
      )}
    </div>
  );
}
