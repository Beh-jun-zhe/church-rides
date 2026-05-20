import { redirect } from "next/navigation";
import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { ADMIN_PENDING_MESSAGE } from "@/lib/constants";
import { requireAuth } from "@/lib/auth";
import { submitOnboardingChoice } from "@/lib/actions/onboarding";

export default async function OnboardingPage() {
  const { profile } = await requireAuth("/onboarding");

  if (profile.role === "owner") {
    redirect("/owner");
  }

  if (profile.role === "driver") {
    redirect("/driver");
  }

  if (profile.role === "admin" && profile.admin_status === "approved") {
    redirect("/admin");
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <AppHeader
        profile={profile}
        title="Role setup"
        subtitle="Choose your role to access the right dashboard for church ride coordination."
      />

      {profile.role === "admin" && profile.admin_status === "pending" ? (
        <SectionCard title="Admin request pending">
          <p className="text-sm text-slate-700">{ADMIN_PENDING_MESSAGE}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Choose your role" description="You can switch roles later if the owner updates your access.">
        <form action={submitOnboardingChoice} className="grid gap-3 sm:grid-cols-3">
          <button
            type="submit"
            name="role_choice"
            value="rider"
            className="rounded-xl border border-slate-300 bg-white p-4 text-left transition hover:border-rose-400 hover:bg-rose-50"
          >
            <p className="text-base font-semibold text-slate-900">Rider</p>
            <p className="mt-1 text-sm text-slate-600">Request rides from campus to church.</p>
          </button>

          <button
            type="submit"
            name="role_choice"
            value="driver"
            className="rounded-xl border border-slate-300 bg-white p-4 text-left transition hover:border-rose-400 hover:bg-rose-50"
          >
            <p className="text-base font-semibold text-slate-900">Driver</p>
            <p className="mt-1 text-sm text-slate-600">Offer seats and view assigned riders.</p>
          </button>

          <button
            type="submit"
            name="role_choice"
            value="admin"
            className="rounded-xl border border-slate-300 bg-white p-4 text-left transition hover:border-rose-400 hover:bg-rose-50"
          >
            <p className="text-base font-semibold text-slate-900">Request admin access</p>
            <p className="mt-1 text-sm text-slate-600">Manage assignments after owner approval.</p>
          </button>
        </form>
      </SectionCard>
    </main>
  );
}
