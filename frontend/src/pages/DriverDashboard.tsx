import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Ride } from "../api";
import { useAuth } from "../auth";
import StatusBadge from "../components/StatusBadge";
import RatingForm from "../components/RatingForm";
import MiniMap from "../components/MiniMap";
import {
  formatDistance,
  formatDuration,
  formatMoney,
} from "../pricing";

export default function DriverDashboard() {
  const { user } = useAuth();
  const [openRides, setOpenRides] = useState<Ride[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [open, mine] = await Promise.all([
        api.listOpenRides(),
        api.listMyRides(),
      ]);
      setOpenRides(open);
      setMyRides(mine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rides");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function placeBid(
    rideId: number,
    amount: number,
    eta: number,
    message: string
  ) {
    try {
      await api.placeBid(rideId, {
        amount,
        eta_minutes: eta,
        message,
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bid");
    }
  }

  async function startRide(rideId: number) {
    try {
      await api.startRide(rideId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start ride");
    }
  }

  async function completeRide(rideId: number) {
    try {
      await api.completeRide(rideId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete ride");
    }
  }

  async function cancelRide(rideId: number) {
    try {
      await api.cancelRide(rideId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel ride");
    }
  }

  async function rateRide(rideId: number, stars: number, comment: string) {
    try {
      await api.rateRide(rideId, stars, comment);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Open ride requests
        </h2>
        {openRides.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500">
            No open rides right now. Check back in a moment.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {openRides.map((ride) => {
            const myBid = ride.bids.find((b) => b.driver_id === user?.id);
            return (
              <OpenRideCard
                key={ride.id}
                ride={ride}
                myBidAmount={myBid?.amount}
                onBid={placeBid}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Your bids & trips
        </h2>
        {myRides.length === 0 && (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500">
            You haven't placed any bids yet.
          </div>
        )}
        <div className="space-y-3">
          {myRides.map((ride) => {
            const myBid = ride.bids.find((b) => b.driver_id === user?.id);
            if (!myBid) return null;
            const amIAcceptedDriver = ride.accepted_bid_id === myBid.id;
            return (
              <div
                key={ride.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">
                      {ride.pickup} → {ride.dropoff}
                    </p>
                    <p className="text-xs text-slate-500">
                      Your bid: {formatMoney(myBid.amount)} · ETA{" "}
                      {myBid.eta_minutes}m · rider {ride.rider_name}
                    </p>
                  </div>
                  <StatusBadge status={ride.status} />
                </div>

                {amIAcceptedDriver && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {ride.status === "accepted" && (
                      <>
                        <button
                          onClick={() => startRide(ride.id)}
                          className="text-sm bg-brand hover:bg-brand-dark text-white px-3 py-1.5 rounded-md"
                        >
                          Start trip
                        </button>
                        <button
                          onClick={() => cancelRide(ride.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {ride.status === "in_progress" && (
                      <button
                        onClick={() => completeRide(ride.id)}
                        className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md"
                      >
                        Complete trip
                      </button>
                    )}
                  </div>
                )}

                {ride.status === "completed" &&
                  amIAcceptedDriver &&
                  ride.driver_to_rider_stars === null && (
                    <RatingForm
                      label={`Rate ${ride.rider_name ?? "rider"}`}
                      onSubmit={(stars, comment) =>
                        rateRide(ride.id, stars, comment)
                      }
                    />
                  )}

                {ride.status === "completed" &&
                  amIAcceptedDriver &&
                  ride.driver_to_rider_stars !== null && (
                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-2 mt-2">
                      You rated the rider {ride.driver_to_rider_stars}★
                      {ride.driver_to_rider_comment &&
                        ` — "${ride.driver_to_rider_comment}"`}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function OpenRideCard({
  ride,
  myBidAmount,
  onBid,
}: {
  ride: Ride;
  myBidAmount: number | undefined;
  onBid: (rideId: number, amount: number, eta: number, message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [eta, setEta] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onBid(ride.id, Number(amount), Number(eta), message);
    setAmount("");
    setEta("");
    setMessage("");
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="mb-3">
        <p className="font-semibold text-slate-800">
          {ride.pickup} → {ride.dropoff}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
          <span>{ride.rider_name ?? "Rider"}</span>
          <span>·</span>
          <span className="font-medium text-slate-700">
            Budget {formatMoney(ride.max_budget)}
          </span>
          {ride.estimated_fare != null && (
            <>
              <span>·</span>
              <span className="text-sky-600">
                Est. {formatMoney(ride.estimated_fare)}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400 mt-0.5">
          {ride.distance_km != null && (
            <span>{formatDistance(ride.distance_km)}</span>
          )}
          {ride.duration_min != null && (
            <>
              <span>·</span>
              <span>{formatDuration(ride.duration_min)}</span>
            </>
          )}
          {ride.notes && (
            <>
              <span>·</span>
              <span>{ride.notes}</span>
            </>
          )}
          <span>·</span>
          <span>
            {ride.bids.length} bid{ride.bids.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <MiniMap
        pickupLat={ride.pickup_lat}
        pickupLng={ride.pickup_lng}
        dropoffLat={ride.dropoff_lat}
        dropoffLng={ride.dropoff_lng}
      />

      {myBidAmount !== undefined ? (
        <div className="text-sm bg-slate-50 border border-slate-200 rounded-md p-3">
          You bid <strong>{formatMoney(myBidAmount)}</strong> on this ride.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          {ride.estimated_fare != null && (
            <p className="text-xs text-sky-600">
              Suggested bid: {formatMoney(ride.estimated_fare)} (route estimate)
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="1"
              step="10"
              required
              placeholder={
                ride.estimated_fare != null
                  ? `~ ${Math.round(ride.estimated_fare)}`
                  : "Your price (Rs)"
              }
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <input
              type="number"
              min="1"
              required
              placeholder="ETA (min)"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <input
            type="text"
            placeholder="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white font-medium py-2 rounded-md text-sm"
          >
            Place bid
          </button>
        </form>
      )}
    </div>
  );
}
