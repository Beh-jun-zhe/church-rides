import { AppHeader } from "@/components/ui/AppHeader";
import { AdminDragMatchBoard } from "@/components/dashboard/AdminDragMatchBoard";
import { AdminUserIntake } from "@/components/dashboard/AdminUserIntake";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { requireAdmin } from "@/lib/auth";
import { switchSelfRole } from "@/lib/actions/onboarding";
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

      {profile.role === "admin" ? (
        <SectionCard
          title="Quick View Switch"
          description="Use these if you need to continue in rider or driver mode."
        >
          <p className="mb-3 text-sm text-slate-700">
            Switching from admin to rider/driver will remove admin access until owner approves admin role again.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={switchSelfRole}>
              <input type="hidden" name="target_role" value="rider" />
              <ConfirmSubmitButton
                label="Go to Rider View"
                confirmText="Switch your role to rider now? Admin access will be removed until owner approval."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              />
            </form>
            <form action={switchSelfRole}>
              <input type="hidden" name="target_role" value="driver" />
              <ConfirmSubmitButton
                label="Go to Driver View"
                confirmText="Switch your role to driver now? Admin access will be removed until owner approval."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              />
            </form>
          </div>
        </SectionCard>
      ) : null}

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
