"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyAssignmentsButton } from "@/components/dashboard/CopyAssignmentsButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SummaryGrid } from "@/components/ui/SummaryGrid";
import { SectionCard } from "@/components/ui/SectionCard";
import { moveRiderAssignment, runAutoMatch } from "@/lib/actions/admin";
import { FLEXIBLE_TIME_SLOT, RIDER_STATUS_LABELS } from "@/lib/constants";
import { formatPhoneForDisplay } from "@/lib/phone";
import { cn, csvFromRows, formatNullable } from "@/lib/utils";
import type { DashboardSummary, Driver, PickupLocation, Rider, RiderStatus } from "@/lib/types";

type LocationFilter = "all" | PickupLocation;
type StatusFilter = "all" | RiderStatus;
type MessageTone = "green" | "red";

interface DriverCardData extends Driver {
  riders: Rider[];
  seatsFilled: number;
  seatsRemaining: number;
}

function riderTone(status: RiderStatus) {
  if (status === "assigned") return "green" as const;
  if (status === "cancelled") return "slate" as const;
  return "amber" as const;
}

function buildDriverCards(drivers: Driver[], riders: Rider[]) {
  const ridersByDriver = new Map<string, Rider[]>();

  riders.forEach((rider) => {
    if (!rider.assigned_driver_id || rider.status !== "assigned") {
      return;
    }

    const current = ridersByDriver.get(rider.assigned_driver_id) ?? [];
    current.push(rider);
    ridersByDriver.set(rider.assigned_driver_id, current);
  });

  return drivers
    .filter((driver) => driver.active)
    .map((driver) => {
      const assignedRiders = ridersByDriver.get(driver.id) ?? [];
      const seatsFilled = assignedRiders.length;

      return {
        ...driver,
        riders: assignedRiders,
        seatsFilled,
        seatsRemaining: Math.max(driver.available_seats - seatsFilled, 0),
      };
    })
    .sort((a, b) => {
      const locationCompare = a.pickup_location.localeCompare(b.pickup_location);
      if (locationCompare !== 0) return locationCompare;

      const timeCompare = a.pickup_time.localeCompare(b.pickup_time);
      if (timeCompare !== 0) return timeCompare;

      return a.created_at.localeCompare(b.created_at);
    });
}

type AssignmentGate = { ok: true } | { ok: false; reason: string };

function csvPayload(driverCards: DriverCardData[]) {
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

function parseDraggedRiderId(event: React.DragEvent<HTMLElement>) {
  return event.dataTransfer.getData("text/rider-id");
}

export function AdminDragMatchBoard({
  drivers,
  riders,
  summary,
  allowOwnerOverride = false,
}: {
  drivers: Driver[];
  riders: Rider[];
  summary: DashboardSummary;
  allowOwnerOverride?: boolean;
}) {
  const router = useRouter();
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draggedRiderId, setDraggedRiderId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | "coordination" | null>(null);
  const [message, setMessage] = useState<{ tone: MessageTone; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const riderMap = useMemo(() => new Map(riders.map((rider) => [rider.id, rider])), [riders]);
  const driverCards = useMemo(() => buildDriverCards(drivers, riders), [drivers, riders]);
  const driverMap = useMemo(() => new Map(driverCards.map((driver) => [driver.id, driver])), [driverCards]);

  const filteredRiders = useMemo(() => {
    const statusSortValue: Record<RiderStatus, number> = {
      pending_assignment: 0,
      assigned: 1,
      cancelled: 2,
    };

    return riders
      .filter((rider) => {
        const locationMatches = locationFilter === "all" || rider.pickup_location === locationFilter;
        const statusMatches = statusFilter === "all" || rider.status === statusFilter;
        return locationMatches && statusMatches;
      })
      .sort((a, b) => {
        const statusCompare = statusSortValue[a.status] - statusSortValue[b.status];
        if (statusCompare !== 0) return statusCompare;
        return a.created_at.localeCompare(b.created_at);
      });
  }, [locationFilter, riders, statusFilter]);

  const visibleDrivers = useMemo(() => {
    if (locationFilter === "all") return driverCards;
    return driverCards.filter((driver) => driver.pickup_location === locationFilter);
  }, [driverCards, locationFilter]);

  const csv = useMemo(() => csvPayload(driverCards), [driverCards]);
  const downloadUrl = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`, [csv]);

  function isRiderDraggable(rider: Rider) {
    return rider.status !== "cancelled";
  }

  function canAssignRiderToDriver(rider: Rider, driver: DriverCardData): AssignmentGate {
    if (rider.status === "cancelled") {
      return { ok: false, reason: "Cancelled rider requests cannot be assigned." };
    }

    if (!allowOwnerOverride && rider.pickup_location !== driver.pickup_location) {
      return { ok: false, reason: "Pickup location must match the driver location." };
    }

    if (
      !allowOwnerOverride &&
      rider.selected_time !== driver.pickup_time &&
      rider.selected_time !== FLEXIBLE_TIME_SLOT
    ) {
      return { ok: false, reason: "Pickup time must match this driver or be set to coordination." };
    }

    const movingToDifferentDriver = rider.assigned_driver_id !== driver.id;
    if (movingToDifferentDriver && driver.seatsRemaining <= 0) {
      return { ok: false, reason: "This car is full. Choose a driver with seats available." };
    }

    return { ok: true };
  }

  async function moveAssignment(riderId: string, driverId: string | null) {
    if (!riderId) return;

    const rider = riderMap.get(riderId);
    if (!rider) {
      setMessage({ tone: "red", text: "Rider was not found." });
      return;
    }

    if (driverId) {
      const targetDriver = driverMap.get(driverId);
      if (!targetDriver) {
        setMessage({ tone: "red", text: "Driver was not found." });
        return;
      }

      if (rider.assigned_driver_id === driverId && rider.status === "assigned") {
        setMessage({ tone: "green", text: "Rider is already assigned to this driver." });
        return;
      }

      const gate = canAssignRiderToDriver(rider, targetDriver);
      if (!gate.ok) {
        setMessage({ tone: "red", text: gate.reason });
        return;
      }
    } else if (rider.status === "pending_assignment" && !rider.assigned_driver_id) {
      setMessage({ tone: "green", text: "Rider is already in coordination." });
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await moveRiderAssignment(riderId, driverId);

        if (!result.ok) {
          setMessage({ tone: "red", text: result.error ?? "Unable to update assignment." });
          return;
        }

        setMessage({
          tone: "green",
          text: driverId ? "Rider assignment updated." : "Rider moved back to coordination.",
        });
        router.refresh();
      })();
    });
  }

  function onRiderDragStart(event: React.DragEvent<HTMLElement>, riderId: string) {
    setDraggedRiderId(riderId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/rider-id", riderId);
  }

  function onRiderDragEnd() {
    setDraggedRiderId(null);
    setDropTargetId(null);
  }

  function onDriverDragOver(event: React.DragEvent<HTMLElement>, driver: DriverCardData) {
    const riderId = draggedRiderId ?? parseDraggedRiderId(event);
    if (!riderId) return;

    const rider = riderMap.get(riderId);
    if (!rider) return;

    const gate = canAssignRiderToDriver(rider, driver);
    if (!gate.ok) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(driver.id);
  }

  function onDriverDrop(event: React.DragEvent<HTMLElement>, driverId: string) {
    event.preventDefault();
    const riderId = parseDraggedRiderId(event);
    setDropTargetId(null);
    setDraggedRiderId(null);
    if (!riderId) return;
    void moveAssignment(riderId, driverId);
  }

  function onCoordinationDragOver(event: React.DragEvent<HTMLElement>) {
    const riderId = draggedRiderId ?? parseDraggedRiderId(event);
    if (!riderId) return;

    const rider = riderMap.get(riderId);
    if (!rider || rider.status === "cancelled") return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId("coordination");
  }

  function onCoordinationDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const riderId = parseDraggedRiderId(event);
    setDropTargetId(null);
    setDraggedRiderId(null);
    if (!riderId) return;
    void moveAssignment(riderId, null);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Dashboard Summary"
        description="Quick totals for seat capacity and assignment progress."
        right={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  void (async () => {
                    try {
                      await runAutoMatch();
                      setMessage({ tone: "green", text: "Auto-match finished." });
                      router.refresh();
                    } catch (error) {
                      setMessage({
                        tone: "red",
                        text: error instanceof Error ? error.message : "Auto-match could not run.",
                      });
                    }
                  })();
                });
              }}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
            >
              Run auto-match
            </button>
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

      <SectionCard
        title="Drag-and-Drop Matching Board"
        description="Drag a rider into a driver card to confirm the match. Drag to another driver to move the assignment."
      >
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rider location filter
              </span>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value as LocationFilter)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All locations</option>
                <option value="North Campus">North Campus</option>
                <option value="South Campus">South Campus</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rider status filter
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="pending_assignment">Coordinating ride</option>
                <option value="assigned">Ride confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">How it works</p>
              <p>
                {allowOwnerOverride
                  ? "Owner override is on. You can match across location/time when needed. Capacity is still enforced."
                  : "Drag riders to drivers with matching location and time. Capacity is enforced automatically."}
              </p>
            </div>
          </div>

          {message ? (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                message.tone === "green" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800",
              )}
            >
              {message.text}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Rider Requests</h3>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {filteredRiders.length} shown
                </p>
              </div>

              <div
                onDragOver={onCoordinationDragOver}
                onDrop={onCoordinationDrop}
                onDragLeave={() => {
                  if (dropTargetId === "coordination") {
                    setDropTargetId(null);
                  }
                }}
                className={cn(
                  "rounded-xl border-2 border-dashed p-3 text-sm transition",
                  dropTargetId === "coordination"
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-300 bg-slate-50 text-slate-700",
                )}
              >
                Drop rider here to keep the request in <span className="font-semibold">Coordinating ride</span>.
              </div>

              <div className="max-h-[720px] space-y-3 overflow-auto pr-1">
                {filteredRiders.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    No riders match the selected filters.
                  </p>
                ) : (
                  filteredRiders.map((rider) => {
                    const assignedDriver =
                      rider.assigned_driver_id ? driverMap.get(rider.assigned_driver_id) ?? null : null;
                    const draggable = isRiderDraggable(rider);

                    return (
                      <article
                        key={rider.id}
                        draggable={draggable}
                        onDragStart={(event) => onRiderDragStart(event, rider.id)}
                        onDragEnd={onRiderDragEnd}
                        className={cn(
                          "rounded-xl border bg-white p-3 shadow-sm transition",
                          draggable ? "cursor-grab border-slate-200 hover:border-slate-300" : "border-slate-100",
                          draggedRiderId === rider.id ? "opacity-60" : "",
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{rider.full_name}</p>
                          <StatusBadge label={RIDER_STATUS_LABELS[rider.status]} tone={riderTone(rider.status)} />
                        </div>
                        <div className="grid gap-1 text-sm text-slate-700">
                          <p>
                            <span className="font-semibold">Phone:</span> {formatPhoneForDisplay(rider.phone)}
                          </p>
                          <p>
                            <span className="font-semibold">Pickup:</span> {rider.pickup_location} |{" "}
                            {rider.selected_time}
                          </p>
                          <p>
                            <span className="font-semibold">Notes:</span> {formatNullable(rider.notes)}
                          </p>
                          {assignedDriver ? (
                            <p>
                              <span className="font-semibold">Assigned driver:</span> {assignedDriver.full_name}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Driver Availability</h3>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {visibleDrivers.length} drivers
                </p>
              </div>

              <div className="max-h-[720px] space-y-3 overflow-auto pr-1">
                {visibleDrivers.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    No active drivers for the current location filter.
                  </p>
                ) : (
                  visibleDrivers.map((driver) => (
                    <article key={driver.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{driver.full_name}</p>
                        <StatusBadge
                          label={
                            driver.seatsRemaining > 0
                              ? `${driver.seatsRemaining} seats available`
                              : "Full car"
                          }
                          tone={driver.seatsRemaining > 0 ? "green" : "red"}
                        />
                      </div>
                      <div className="grid gap-1 text-sm text-slate-700">
                        <p>
                          <span className="font-semibold">Phone:</span> {formatPhoneForDisplay(driver.phone)}
                        </p>
                        <p>
                          <span className="font-semibold">Pickup:</span> {driver.pickup_location} |{" "}
                          {driver.pickup_time}
                        </p>
                        <p>
                          <span className="font-semibold">Seats:</span> {driver.seatsFilled} / {driver.available_seats}{" "}
                          filled
                        </p>
                        <p>
                          <span className="font-semibold">Driver notes:</span> {formatNullable(driver.notes)}
                        </p>
                      </div>

                      <div
                        onDragOver={(event) => onDriverDragOver(event, driver)}
                        onDrop={(event) => onDriverDrop(event, driver.id)}
                        onDragLeave={() => {
                          if (dropTargetId === driver.id) {
                            setDropTargetId(null);
                          }
                        }}
                        className={cn(
                          "mt-3 rounded-lg border-2 border-dashed p-2 text-xs font-semibold uppercase tracking-wide transition",
                          dropTargetId === driver.id
                            ? "border-sky-400 bg-sky-50 text-sky-800"
                            : "border-slate-300 bg-slate-50 text-slate-500",
                        )}
                      >
                        Drop rider here to assign
                      </div>

                      <div className="mt-3 space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned riders</h4>
                        {driver.riders.length === 0 ? (
                          <p className="text-sm text-slate-600">No riders assigned yet.</p>
                        ) : (
                          driver.riders.map((rider) => (
                            <article
                              key={rider.id}
                              draggable
                              onDragStart={(event) => onRiderDragStart(event, rider.id)}
                              onDragEnd={onRiderDragEnd}
                              className={cn(
                                "rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm",
                                "cursor-grab",
                                draggedRiderId === rider.id ? "opacity-60" : "",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-slate-900">{rider.full_name}</p>
                                <StatusBadge label={RIDER_STATUS_LABELS[rider.status]} tone={riderTone(rider.status)} />
                              </div>
                              <p className="text-slate-700">
                                {rider.pickup_location} | {rider.selected_time}
                              </p>
                            </article>
                          ))
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
