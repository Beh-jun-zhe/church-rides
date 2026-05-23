import { AppHeader } from "@/components/ui/AppHeader";
import { AdminDragMatchBoard } from "@/components/dashboard/AdminDragMatchBoard";
import { AdminUserIntake } from "@/components/dashboard/AdminUserIntake";
import { requireAdmin } from "@/lib/auth";
import { buildSummary } from "@/lib/data";
import { formatServiceSunday, getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { Driver, Profile, Rider } from "@/lib/types";

export default async function AdminPage() {
  const { profile, supabase } = await requireAdmin("/admin");
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const serviceSundayLabel = formatServiceSunday(serviceSunday);

  const [{ data: drivers }, { data: riders }, { data: profiles }] = await Promise.all([
    supabase
      .from("drivers")
      .select("*")
      .eq("sunday_date", serviceSunday)
      .order("pickup_location")
      .order("pickup_time")
      .order("created_at"),
    supabase.from("riders").select("*").eq("sunday_date", serviceSunday).order("created_at"),
    supabase.from("profiles").select("*").order("created_at"),
  ]);

  const allDrivers = (drivers as Driver[] | null) ?? [];
  const allRiders = (riders as Rider[] | null) ?? [];
  const allProfiles = (profiles as Profile[] | null) ?? [];

  const summary = buildSummary(allDrivers, allRiders);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <AppHeader
        profile={profile}
        title="Admin Dashboard"
        subtitle={`Managing rides for ${serviceSundayLabel}. Match riders to drivers, coordinate pending requests, and export final assignments.`}
      />

      <AdminUserIntake
        users={allProfiles}
        drivers={allDrivers}
        riders={allRiders}
        actorRole={profile.role === "owner" ? "owner" : "admin"}
      />

      <AdminDragMatchBoard
        drivers={allDrivers}
        riders={allRiders}
        summary={summary}
        allowOwnerOverride={profile.role === "owner"}
      />
    </main>
  );
}
