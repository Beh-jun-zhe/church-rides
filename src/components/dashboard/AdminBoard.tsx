import { assignRiderToDriver, runAutoMatch, unassignRider, updateRiderAdminNote } from "@/lib/actions/admin";
import { SectionCard } from "@/components/ui/SectionCard";
import { SummaryGrid } from "@/components/ui/SummaryGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RIDER_STATUS_LABELS } from "@/lib/constants";
import { formatPhoneForDisplay } from "@/lib/phone";
import { csvFromRows, formatNullable } from "@/lib/utils";
import type { DashboardSummary, Driver, DriverCard, Rider } from "@/lib/types";
import { CopyAssignmentsButton } from "@/components/dashboard/CopyAssignmentsButton";

function badgeTone(status: Rider["status"]) {
  if (status === "assigned") return "green" as const;
  if (status === "cancelled") return "slate" as const;
  return "amber" as const;
}

function csvPayload(driverCards: DriverCard[]) {
  const rows: string[][] = [];

  driverCards.forEach((driver) => {
    if (!driver.riders.length) {
      rows.push([
        driver.full_name,
        driver.phone,
        driver.pickup_location,
        driver.pickup_time,
        `${driver.seatsFilled}/${driver.available_seats}`,
        "",
        "",
        "",
        "",
      ]);
      return;
    }

    driver.riders.forEach((rider, index) => {
      rows.push([
        index === 0 ? driver.full_name : "",
        index === 0 ? driver.phone : "",
        index === 0 ? driver.pickup_location : "",
        index === 0 ? driver.pickup_time : "",
        index === 0 ? `${driver.seatsFilled}/${driver.available_seats}` : "",
        rider.full_name,
        rider.phone,
        rider.pickup_location,
        rider.selected_time,
      ]);
    });
  });

  return csvFromRows(
    [
      "Driver",
      "Driver Phone",
      "Pickup Location",
      "Pickup Time",
      "Seats",
      "Rider",
      "Rider Phone",
      "Rider Pickup",
      "Rider Time",
    ],
    rows,
  );
}

function eligibleDrivers(drivers: Driver[], rider: Rider) {
  return drivers.filter(
    (driver) =>
      driver.active &&
      driver.pickup_location === rider.pickup_location &&
      driver.pickup_time === rider.selected_time,
  );
}

export function AdminBoard({
  drivers,
  driverCards,
  needsCoordination,
  summary,
}: {
  drivers: Driver[];
  driverCards: DriverCard[];
  needsCoordination: Rider[];
  summary: DashboardSummary;
}) {
  const csv = csvPayload(driverCards);
  const downloadUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Dashboard Summary"
        description="Quick totals for seat capacity and assignment progress."
        right={
          <div className="flex flex-wrap gap-2">
            <form action={runAutoMatch}>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
              >
                Run auto-match
              </button>
            </form>
            <a
              href={downloadUrl}
              download="ride-assignments.csv"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Export CSV
            </a>
            <CopyAssignmentsButton text={csv} />
          </div>
        }
      >
        <SummaryGrid summary={summary} />
      </SectionCard>

      <SectionCard title="Needs Coordination" description="Riders currently pending assignment.">
        {needsCoordination.length === 0 ? (
          <p className="text-sm text-slate-600">No riders need coordination right now.</p>
        ) : (
          <div className="space-y-4">
            {needsCoordination.map((rider) => {
              const candidates = eligibleDrivers(drivers, rider);

              return (
                <article key={rider.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{rider.full_name}</p>
                    <StatusBadge label={RIDER_STATUS_LABELS[rider.status]} tone={badgeTone(rider.status)} />
                  </div>
                  <div className="grid gap-1 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold">Phone:</span> {formatPhoneForDisplay(rider.phone)}
                    </p>
                    <p>
                      <span className="font-semibold">Pickup:</span> {rider.pickup_location} at {rider.selected_time}
                    </p>
                    <p>
                      <span className="font-semibold">Rider notes:</span> {formatNullable(rider.notes)}
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <form action={assignRiderToDriver} className="flex flex-wrap gap-2">
                      <input type="hidden" name="rider_id" value={rider.id} />
                      <select
                        name="driver_id"
                        required
                        defaultValue={candidates[0]?.id ?? ""}
                        className="min-w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="" disabled>
                          Select a matching driver
                        </option>
                        {candidates.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.full_name} | {driver.pickup_location} {driver.pickup_time}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!candidates.length}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                      >
                        Assign rider
                      </button>
                    </form>
                  </div>

                  <form action={updateRiderAdminNote} className="mt-2">
                    <input type="hidden" name="rider_id" value={rider.id} />
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Internal coordination note
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        name="admin_note"
                        defaultValue={rider.admin_note ?? ""}
                        placeholder="Add admin-only coordination notes"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <section className="space-y-4">
        {driverCards.map((driver) => (
          <SectionCard
            key={driver.id}
            title={`Driver: ${driver.full_name}`}
            description={`${driver.pickup_location} • ${driver.pickup_time}`}
            right={
              <StatusBadge
                label={`${driver.seatsFilled} / ${driver.available_seats} filled`}
                tone={driver.seatsRemaining > 0 ? "green" : "red"}
              />
            }
          >
            <div className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
              <p>
                <span className="font-semibold">Phone:</span> {formatPhoneForDisplay(driver.phone)}
              </p>
              <p>
                <span className="font-semibold">Seats remaining:</span> {driver.seatsRemaining}
              </p>
              <p className="sm:col-span-2">
                <span className="font-semibold">Driver notes:</span> {formatNullable(driver.notes)}
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assigned riders</h3>
              {driver.riders.length === 0 ? (
                <p className="text-sm text-slate-600">No riders assigned yet.</p>
              ) : (
                driver.riders.map((rider, index) => {
                  const candidates = eligibleDrivers(drivers, rider);

                  return (
                    <article key={rider.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {index + 1}. {rider.full_name}
                      </p>
                      <div className="mt-1 grid gap-1 text-sm text-slate-700">
                        <p>
                          <span className="font-semibold">Phone:</span> {formatPhoneForDisplay(rider.phone)}
                        </p>
                        <p>
                          <span className="font-semibold">Pickup:</span> {rider.pickup_location} at {rider.selected_time}
                        </p>
                        <p>
                          <span className="font-semibold">Rider notes:</span> {formatNullable(rider.notes)}
                        </p>
                        <p>
                          <span className="font-semibold">Admin notes:</span> {formatNullable(rider.admin_note)}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={assignRiderToDriver} className="flex flex-wrap gap-2">
                          <input type="hidden" name="rider_id" value={rider.id} />
                          <select
                            name="driver_id"
                            defaultValue={driver.id}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            {candidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.full_name} | {candidate.pickup_time}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Move rider
                          </button>
                        </form>

                        <form action={unassignRider}>
                          <input type="hidden" name="rider_id" value={rider.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            Remove rider
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </SectionCard>
        ))}
      </section>
    </div>
  );
}
