import { useCallback, useEffect, useState } from "react";
import { AdminStats, api, Ride, User } from "../api";
import StatusBadge from "../components/StatusBadge";
import { formatDistance, formatDuration, formatMoney } from "../pricing";

type Tab = "overview" | "users" | "rides";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(["overview", "users", "rides"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab />}
      {tab === "rides" && <RidesTab />}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-slate-900",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminStats()
      .then(setStats)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load stats")
      );
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!stats) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        Users
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users" value={stats.users.total} />
        <StatCard label="Riders" value={stats.users.riders} color="text-brand" />
        <StatCard
          label="Drivers"
          value={stats.users.drivers}
          color="text-emerald-600"
        />
        <StatCard label="Total bids" value={stats.bids.total} />
      </div>

      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        Rides
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total rides" value={stats.rides.total} />
        <StatCard
          label="Open"
          value={stats.rides.open}
          color="text-emerald-600"
        />
        <StatCard
          label="Active"
          value={stats.rides.active}
          color="text-amber-600"
        />
        <StatCard label="Completed" value={stats.rides.completed} />
        <StatCard
          label="Cancelled"
          value={stats.rides.cancelled}
          color="text-red-600"
        />
      </div>

      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
        Revenue
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total (completed rides)"
          value={formatMoney(stats.revenue.total)}
          color="text-brand-dark"
        />
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminUsers()
      .then(setUsers)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load users")
      );
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-500">{u.id}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{u.full_name}</td>
              <td className="px-4 py-3 text-slate-600">{u.email}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    u.role === "rider"
                      ? "bg-sky-100 text-sky-700"
                      : u.role === "driver"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RidesTab() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(() => {
    api
      .adminRides()
      .then(setRides)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load rides")
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-red-600">{error}</p>;

  const filtered =
    filter === "all" ? rides : rides.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["all", "open", "accepted", "in_progress", "completed", "cancelled"].map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-md border font-medium capitalize ${
                filter === f
                  ? "bg-brand text-white border-brand"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {f === "in_progress" ? "In progress" : f}
            </button>
          )
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">ID</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Route</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Rider</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Budget</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Trip</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Bids</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => {
              const winner = r.bids.find((b) => b.id === r.accepted_bid_id);
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{r.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 truncate max-w-[220px]">
                      {r.pickup}
                    </p>
                    <p className="text-xs text-slate-500 truncate max-w-[220px]">
                      → {r.dropoff}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.rider_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">
                      {formatMoney(r.max_budget)}
                    </p>
                    {winner && (
                      <p className="text-xs text-emerald-600">
                        Won: {formatMoney(winner.amount)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {r.distance_km != null
                      ? `${formatDistance(r.distance_km)} · ${formatDuration(r.duration_min ?? 0)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.bids.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 py-8">
            No rides matching filter.
          </p>
        )}
      </div>
    </div>
  );
}
