import type { Driver } from "@/lib/types";
import { PICKUP_LOCATIONS } from "@/lib/constants";
import { copyPreviousDriverAvailability, upsertDriverAvailability } from "@/lib/actions/driver";
import { formatPhoneForDisplay } from "@/lib/phone";

export function DriverAvailabilityForm({
  email,
  driver,
  scheduleLocked,
}: {
  email: string;
  driver: Driver | null;
  scheduleLocked: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Quick start</p>
        <p className="mt-1">
          Sign in with your email and password, set your pickup location, time, and available seats for this Sunday,
          then tap Save. You can update your availability until Saturday noon.
        </p>
      </div>

      <form action={upsertDriverAvailability} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Full name</span>
            <input
              name="full_name"
              required
              defaultValue={driver?.full_name ?? ""}
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
              defaultValue={driver?.phone ? formatPhoneForDisplay(driver.phone) : ""}
              disabled={scheduleLocked}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Available seats</span>
            <input
              name="available_seats"
              type="number"
              min={1}
              required
              defaultValue={driver?.available_seats ?? 1}
              disabled={scheduleLocked}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Pickup location</span>
            <select
              name="pickup_location"
              required
              defaultValue={driver?.pickup_location ?? PICKUP_LOCATIONS[0]}
              disabled={scheduleLocked}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            >
              {PICKUP_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Preferred pickup time slot</span>
            <input
              name="pickup_time"
              required
              defaultValue={driver?.pickup_time ?? "10:10 AM"}
              placeholder="10:10 AM"
              disabled={scheduleLocked}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={driver?.notes ?? ""}
            disabled={scheduleLocked}
            placeholder="Example: I can wait near the bookstore entrance."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-rose-500 focus:ring disabled:bg-slate-100"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={scheduleLocked}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save driver availability
          </button>
        </div>
      </form>

      <form action={copyPreviousDriverAvailability}>
        <button
          type="submit"
          disabled={scheduleLocked}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy last Sunday availability
        </button>
      </form>
    </div>
  );
}
