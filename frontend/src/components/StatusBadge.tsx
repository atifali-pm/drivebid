import { RideStatus } from "../api";

const STYLES: Record<RideStatus, string> = {
  open: "bg-emerald-100 text-emerald-800",
  accepted: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-red-700",
};

const LABELS: Record<RideStatus, string> = {
  open: "open",
  accepted: "accepted",
  in_progress: "in progress",
  completed: "completed",
  cancelled: "cancelled",
};

export default function StatusBadge({ status }: { status: RideStatus }) {
  return (
    <span
      className={`text-xs uppercase px-2 py-1 rounded-full font-medium whitespace-nowrap ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
