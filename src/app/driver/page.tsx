import { AppHeader } from "@/components/ui/AppHeader";
import { DriverAvailabilityForm } from "@/components/forms/DriverAvailabilityForm";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireDriver } from "@/lib/auth";
import { formatServiceSunday, getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { Driver, Rider } from "@/lib/types";
import { formatNullable } from "@/lib/utils";

export default async function DriverPage() {
  const { profile, user, supabase } = await requireDriver("/driver");
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const serviceSundayLabel = formatServiceSunday(serviceSunday);

  const [{ data: driver }, { data: scheduleLocked }] = await Promise.all([
    supabase.from("drivers").select("*").eq("user_id", profile.id).eq("sunday_date", serviceSunday).maybeSingle(),
    supabase.rpc("is_schedule_locked_now"),
  ]);

  const driverRecord = (driver as Driver | null) ?? null;
  const assignedRidersResult = driverRecord
    ? await supabase
        .from("riders")
        .select("*")
        .eq("assigned_driver_id", driverRecord.id)
        .eq("sunday_date", serviceSunday)
        .eq("status", "assigned")
        .order("created_at")
    : { data: [] as Rider[] | null };

  const assignedRiders = (assignedRidersResult.data as Rider[] | null) ?? [];
  const seatsFilled = assignedRiders.length;
  const seatsRemaining = Math.max((driverRecord?.available_seats ?? 0) - seatsFilled, 0);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <AppHeader
        profile={profile}
        title="Driver Dashboard"
        subtitle={`For ${serviceSundayLabel}. Share your ride availability and view assigned riders.`}
      />

      <SectionCard title="Driver availability" description="Keep your pickup location, time, and seat count updated.">
        <DriverAvailabilityForm
          email={user.email ?? ""}
          driver={driverRecord}
          scheduleLocked={Boolean(scheduleLocked)}
        />
      </SectionCard>

      <SectionCard
        title="Assigned riders"
        description="Riders are visible here after admin matching or auto-match."
        right={
          driverRecord ? (
            <StatusBadge
              label={`${seatsFilled} / ${driverRecord.available_seats} filled`}
              tone={seatsRemaining > 0 ? "green" : "red"}
            />
          ) : null
        }
      >
        {!driverRecord ? (
          <p className="text-sm text-slate-600">Complete your availability form first to begin receiving riders.</p>
        ) : assignedRiders.length === 0 ? (
          <p className="text-sm text-slate-600">No riders assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {assignedRiders.map((rider, index) => (
              <article key={rider.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">
                  {index + 1}. {rider.full_name}
                </p>
                <div className="mt-1 grid gap-1 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Pickup:</span> {rider.pickup_location}
                  </p>
                  <p>
                    <span className="font-semibold">Time:</span> {rider.selected_time}
                  </p>
                  <p>
                    <span className="font-semibold">Notes:</span> {formatNullable(rider.notes)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        {scheduleLocked ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
            Schedule edits are currently locked. Please contact admin if changes are needed.
          </p>
        ) : null}
      </SectionCard>
    </main>
  );
}
