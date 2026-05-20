import { AppHeader } from "@/components/ui/AppHeader";
import { RiderRequestForm } from "@/components/forms/RiderRequestForm";
import { SectionCard } from "@/components/ui/SectionCard";
import { requireRider } from "@/lib/auth";
import { formatServiceSunday, getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { Driver, Rider } from "@/lib/types";

export default async function RiderPage() {
  const { profile, user, supabase } = await requireRider("/rider");
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const serviceSundayLabel = formatServiceSunday(serviceSunday);

  const [{ data: rider }, { data: driverSlots }, { data: scheduleLocked }] = await Promise.all([
    supabase.from("riders").select("*").eq("user_id", profile.id).eq("sunday_date", serviceSunday).maybeSingle(),
    supabase.rpc("available_driver_slots"),
    supabase.rpc("is_schedule_locked_now"),
  ]);

  const slotsByLocation = {
    "North Campus": [] as string[],
    "South Campus": [] as string[],
  };

  (driverSlots as Array<{ pickup_location: string; pickup_time: string }> | null | undefined)?.forEach((slot) => {
    const location = slot.pickup_location as "North Campus" | "South Campus";
    const time = slot.pickup_time as string;
    if (!slotsByLocation[location].includes(time)) {
      slotsByLocation[location].push(time);
    }
  });

  slotsByLocation["North Campus"].sort();
  slotsByLocation["South Campus"].sort();

  let assignedDriver: Pick<Driver, "full_name" | "pickup_location" | "pickup_time" | "notes"> | null = null;

  if ((rider as Rider | null)?.assigned_driver_id) {
    const { data } = await supabase
      .from("drivers")
      .select("full_name,pickup_location,pickup_time,notes")
      .eq("id", (rider as Rider).assigned_driver_id)
      .maybeSingle();

    assignedDriver = (data as Pick<Driver, "full_name" | "pickup_location" | "pickup_time" | "notes"> | null) ?? null;
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <AppHeader
        profile={profile}
        title="Rider Dashboard"
        subtitle={`For ${serviceSundayLabel}. Submit your pickup request and track assignment progress.`}
      />

      <SectionCard title="Ride request" description="Pickup options update based on active driver availability.">
        <RiderRequestForm
          email={user.email ?? ""}
          rider={(rider as Rider | null) ?? null}
          availableSlotsByLocation={slotsByLocation}
          assignedDriver={assignedDriver}
          scheduleLocked={Boolean(scheduleLocked)}
        />
      </SectionCard>
    </main>
  );
}
