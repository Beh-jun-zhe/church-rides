import { SectionCard } from "@/components/ui/SectionCard";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { PICKUP_LOCATIONS } from "@/lib/constants";
import {
  removeDriverAvailability,
  removeRiderRequest,
  upsertDriverForUser,
  upsertRiderForUser,
} from "@/lib/actions/admin";
import type { Driver, Profile, Rider } from "@/lib/types";

function displayUser(profile: Profile) {
  const name = profile.full_name?.trim() || "No name";
  return `${name} • ${profile.email}`;
}

export function AdminUserIntake({
  users,
  drivers,
  riders,
  actorRole,
}: {
  users: Profile[];
  drivers: Driver[];
  riders: Rider[];
  actorRole: "owner" | "admin";
}) {
  const manageableUsers = users.filter((user) => user.role !== "owner");
  const activeSlots = Array.from(
    new Set(drivers.filter((driver) => driver.active).map((driver) => `${driver.pickup_location} | ${driver.pickup_time}`)),
  ).sort();

  const driverByUserId = new Map(drivers.map((driver) => [driver.user_id, driver]));
  const riderByUserId = new Map(riders.map((rider) => [rider.user_id, rider]));

  return (
    <SectionCard
      title="Admin Tools: Add or Update Rider and Driver"
      description="Create or edit rider and driver records for users who have already signed in once."
    >
      <div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <p>
          Users must sign in first so a profile exists.{" "}
          {actorRole === "owner"
            ? "Owner submissions here also set the target role automatically."
            : "Admins can create records, and owner can adjust user roles in Owner Dashboard."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form action={upsertDriverForUser} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Add or Update Driver</h3>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">User</span>
            <select
              name="user_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select user
              </option>
              {manageableUsers.map((user) => {
                const hasDriver = driverByUserId.has(user.id);
                return (
                  <option key={user.id} value={user.id}>
                    {displayUser(user)}
                    {hasDriver ? " (has driver profile)" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Full name</span>
            <input name="full_name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Phone number</span>
            <input
              name="phone"
              required
              type="tel"
              placeholder="(123) 456-7890"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Pickup location</span>
              <select name="pickup_location" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {PICKUP_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Pickup time</span>
              <input
                name="pickup_time"
                required
                placeholder="10:10 AM"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Available seats</span>
            <input
              type="number"
              name="available_seats"
              min={1}
              defaultValue={3}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Notes (optional)</span>
            <textarea name="notes" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Save driver record
          </button>
        </form>

        <form action={upsertRiderForUser} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <h3 className="text-base font-semibold text-slate-900">Add or Update Rider</h3>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">User</span>
            <select
              name="user_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select user
              </option>
              {manageableUsers.map((user) => {
                const hasRider = riderByUserId.has(user.id);
                return (
                  <option key={user.id} value={user.id}>
                    {displayUser(user)}
                    {hasRider ? " (has rider request)" : ""}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Full name</span>
            <input name="full_name" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Phone number</span>
            <input
              name="phone"
              required
              type="tel"
              placeholder="(123) 456-7890"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Pickup location</span>
              <select name="pickup_location" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {PICKUP_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Selected time slot</span>
              <input
                name="selected_time"
                required
                placeholder="10:10 AM"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Notes (optional)</span>
            <textarea name="notes" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Save rider request
          </button>

          <div className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Active offered slots</p>
            <p>{activeSlots.length ? activeSlots.join(" • ") : "No active slots yet"}</p>
          </div>
        </form>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <form action={removeDriverAvailability} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-base font-semibold text-slate-900">Remove Driver from This Sunday</h3>
          <p className="text-sm text-slate-700">
            This removes the driver availability and reopens assigned riders for coordination.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Driver</span>
            <select
              name="driver_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select driver
              </option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name} • {driver.pickup_location} {driver.pickup_time}
                </option>
              ))}
            </select>
          </label>
          <ConfirmSubmitButton
            label="Remove driver availability"
            confirmText="Remove this driver availability for this Sunday?"
            submitName="remove_mode"
            submitValue="remove_only"
            className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          />
          <ConfirmSubmitButton
            label="Remove driver + auto-rematch"
            confirmText="Remove this driver and run auto-match now?"
            submitName="remove_mode"
            submitValue="rematch"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          />
        </form>

        <form action={removeRiderRequest} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-base font-semibold text-slate-900">Remove Rider from This Sunday</h3>
          <p className="text-sm text-slate-700">
            This marks the rider as cancelled and removes any assignment.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Rider</span>
            <select
              name="rider_id"
              required
              defaultValue=""
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select rider
              </option>
              {riders
                .filter((rider) => rider.status !== "cancelled")
                .map((rider) => (
                  <option key={rider.id} value={rider.id}>
                    {rider.full_name} • {rider.pickup_location} {rider.selected_time} ({rider.status})
                  </option>
                ))}
            </select>
          </label>
          <ConfirmSubmitButton
            label="Remove rider request"
            confirmText="Cancel this rider request for this Sunday?"
            submitName="remove_mode"
            submitValue="remove_only"
            className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
          />
          <ConfirmSubmitButton
            label="Remove rider + auto-rematch"
            confirmText="Cancel this rider request and run auto-match now?"
            submitName="remove_mode"
            submitValue="rematch"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          />
        </form>
      </div>
    </SectionCard>
  );
}
