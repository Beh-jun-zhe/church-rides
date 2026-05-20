import { AppHeader } from "@/components/ui/AppHeader";
import { AdminDragMatchBoard } from "@/components/dashboard/AdminDragMatchBoard";
import { AdminUserIntake } from "@/components/dashboard/AdminUserIntake";
import { OwnerControls } from "@/components/dashboard/OwnerControls";
import { requireOwner } from "@/lib/auth";
import { buildSummary } from "@/lib/data";
import { formatServiceSunday, getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { Driver, Profile, ReminderRun, Rider } from "@/lib/types";

export default async function OwnerPage() {
  const { profile, supabase } = await requireOwner("/owner");
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const serviceSundayLabel = formatServiceSunday(serviceSunday);

  const [{ data: drivers }, { data: riders }, { data: profiles }, { data: scheduleLocked }, { data: reminderRuns }] =
    await Promise.all([
    supabase
      .from("drivers")
      .select("*")
      .eq("sunday_date", serviceSunday)
      .order("pickup_location")
      .order("pickup_time")
      .order("created_at"),
    supabase.from("riders").select("*").eq("sunday_date", serviceSunday).order("created_at"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.rpc("is_schedule_locked_now"),
    supabase
      .from("reminder_runs")
      .select("*")
      .eq("sunday_date", serviceSunday)
      .order("created_at", { ascending: false })
      .limit(8),
    ]);

  const allDrivers = (drivers as Driver[] | null) ?? [];
  const allRiders = (riders as Rider[] | null) ?? [];
  const allProfiles = (profiles as Profile[] | null) ?? [];
  const recentReminderRuns = (reminderRuns as ReminderRun[] | null) ?? [];

  const summary = buildSummary(allDrivers, allRiders);

  const pendingAdmins = allProfiles.filter(
    (userProfile) => userProfile.role === "admin" && userProfile.admin_status === "pending",
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <AppHeader
        profile={profile}
        title="Owner Dashboard"
        subtitle={`Managing rides for ${serviceSundayLabel}. Approve admins, lock schedule, manage users, and oversee all ride matching.`}
      />

      <OwnerControls
        pendingAdmins={pendingAdmins}
        allUsers={allProfiles}
        scheduleLocked={Boolean(scheduleLocked)}
        recentReminderRuns={recentReminderRuns}
      />

      <AdminUserIntake users={allProfiles} drivers={allDrivers} riders={allRiders} actorRole="owner" />

      <AdminDragMatchBoard drivers={allDrivers} riders={allRiders} summary={summary} allowOwnerOverride />
    </main>
  );
}
