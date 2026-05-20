import type { DashboardSummary } from "@/lib/types";

export function SummaryGrid({ summary }: { summary: DashboardSummary }) {
  const items = [
    ["Total Drivers", summary.totalDrivers],
    ["Total Riders", summary.totalRiders],
    ["Ride Confirmed", summary.confirmedRiders],
    ["Coordinating Ride", summary.coordinatingRiders],
    ["Total Seats", summary.totalSeats],
    ["Seats Remaining", summary.seatsRemaining],
    ["North Campus Riders", summary.northCampusRiders],
    ["South Campus Riders", summary.southCampusRiders],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}
