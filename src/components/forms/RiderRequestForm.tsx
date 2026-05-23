"use client";

import { useState } from "react";
import { FLEXIBLE_TIME_SLOT, PICKUP_LOCATIONS, RIDER_STATUS_LABELS } from "@/lib/constants";
import { upsertRiderRequest, cancelRiderRequest, copyPreviousRiderRequest } from "@/lib/actions/rider";
import { formatPhoneForDisplay } from "@/lib/phone";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import type { Driver, Rider } from "@/lib/types";

interface RiderRequestFormProps {
  email: string;
  rider: Rider | null;
  availableSlotsByLocation: {
    "North Campus": string[];
    "South Campus": string[];
  };
  assignedDriver: Pick<Driver, "full_name" | "pickup_location" | "pickup_time" | "notes"> | null;
  scheduleLocked: boolean;
}

function badgeTone(status: Rider["status"]) {
  if (status === "assigned") return "green" as const;
  if (status === "cancelled") return "slate" as const;
  return "amber" as const;
}

export function RiderRequestForm({
  email,
  rider,
  availableSlotsByLocation,
  assignedDriver,
  scheduleLocked,
}: RiderRequestFormProps) {
  const [pickupLocation, setPickupLocation] = useState(rider?.pickup_location ?? PICKUP_LOCATIONS[0]);
  const availableSlots = availableSlotsByLocation[pickupLocation];
  const noSlotsForLocation = availableSlots.length === 0;
  const [selectedTime, setSelectedTime] = useState(
    rider?.selected_time ?? availableSlots[0] ?? FLEXIBLE_TIME_SLOT,
  );
  const effectiveSelectedTime = noSlotsForLocation
    ? FLEXIBLE_TIME_SLOT
    : availableSlots.includes(selectedTime)
      ? selectedTime
      : (availableSlots[0] ?? "");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Quick start</p>
        <p className="mt-1">
          Sign in with your email and password, fill your pickup details for this Sunday, then tap Save. If your time
          slot is not listed yet, you can still submit and admin will coordinate your ride.
        </p>
      </div>

      {rider ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-2">
            <StatusBadge label={RIDER_STATUS_LABELS[rider.status]} tone={badgeTone(rider.status)} />
          </div>
          {rider.status === "assigned" && assignedDriver ? (
            <div className="space-y-1 text-slate-700">
              <p>
                <span className="font-semibold">Driver:</span> {assignedDriver.full_name}
              </p>
              <p>
                <span className="font-semibold">Pickup:</span> {assignedDriver.pickup_location}
              </p>
              <p>
                <span className="font-semibold">Time:</span> {assignedDriver.pickup_time}
              </p>
              <p>
                <span className="font-semibold">Driver notes:</span> {assignedDriver.notes || "None"}
              </p>
            </div>
          ) : (
            <p className="text-slate-700">
              Your ride request has been received. We are currently coordinating available seats, and you will be
              notified as soon as a driver is confirmed. An admin will reach out regardless, so don&apos;t worry. Final
              ride details will be sorted out by Saturday noon.
            </p>
          )}
        </div>
      ) : null}

      <form action={upsertRiderRequest} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Full name</span>
            <input
              name="full_name"
              required
              defaultValue={rider?.full_name ?? ""}
              disabled={scheduleLocked}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
            <input
              value={email}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Phone number</span>
            <input
              name="phone"
              required
              defaultValue={rider?.phone ? formatPhoneForDisplay(rider.phone) : ""}
              disabled={scheduleLocked}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Pickup location</span>
            <select
              name="pickup_location"
              required
              value={pickupLocation}
              disabled={scheduleLocked}
              onChange={(event) => {
                const nextLocation = event.target.value as "North Campus" | "South Campus";
                setPickupLocation(nextLocation);
                const nextSlots = availableSlotsByLocation[nextLocation];
                setSelectedTime(nextSlots[0] ?? FLEXIBLE_TIME_SLOT);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            >
              {PICKUP_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Preferred pickup time slot</span>
            <select
              name="selected_time"
              required
              value={effectiveSelectedTime}
              disabled={scheduleLocked}
              onChange={(event) => setSelectedTime(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            >
              {noSlotsForLocation ? (
                <option value={FLEXIBLE_TIME_SLOT}>
                  No open time slots yet — submit for coordination
                </option>
              ) : null}
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
            {noSlotsForLocation ? (
              <p className="mt-1 text-xs text-slate-600">
                You can still submit now. Admin will coordinate your ride time when a driver is available.
              </p>
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={rider?.notes ?? ""}
            disabled={scheduleLocked}
            placeholder="Example: I will be near the dorm entrance."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
          />
        </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
            disabled={scheduleLocked}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
          Save ride request
        </button>
      </div>

        {scheduleLocked ? (
          <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            The schedule is currently locked. Please contact an admin if you need help.
          </p>
        ) : null}
      </form>

      {rider ? (
        <form action={cancelRiderRequest}>
          <ConfirmSubmitButton
            label="Cancel request"
            confirmText="Cancel your ride request for this Sunday?"
            disabled={scheduleLocked}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </form>
      ) : null}

      <form action={copyPreviousRiderRequest}>
        <button
          type="submit"
          disabled={scheduleLocked}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy last Sunday request
        </button>
      </form>
    </div>
  );
}
