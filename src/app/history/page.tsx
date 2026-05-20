import { AppHeader } from "@/components/ui/AppHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { buildDriverCards, buildSummary } from "@/lib/data";
import { formatPhoneForDisplay } from "@/lib/phone";
import { formatServiceSunday, getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { AuditLog, Driver, ReminderRun, Rider } from "@/lib/types";
import { formatNullable } from "@/lib/utils";

interface HistoryPageProps {
  searchParams: Promise<{ sunday_date?: string }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const { profile, supabase } = await requireAdmin("/history");
  const params = await searchParams;
  const currentSunday = await getCurrentServiceSunday(supabase);
  const selectedSunday = params.sunday_date ?? currentSunday;

  const [{ data: allDrivers }, { data: allRiders }] = await Promise.all([
    supabase.from("drivers").select("sunday_date").order("sunday_date", { ascending: false }),
    supabase.from("riders").select("sunday_date").order("sunday_date", { ascending: false }),
  ]);

  const sundayOptions = Array.from(
    new Set([...(allDrivers ?? []).map((row) => row.sunday_date), ...(allRiders ?? []).map((row) => row.sunday_date)]),
  )
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a));

  const [{ data: drivers }, { data: riders }, { data: auditLogs }, { data: reminderRuns }] = await Promise.all([
    supabase.from("drivers").select("*").eq("sunday_date", selectedSunday).order("pickup_location").order("pickup_time"),
    supabase.from("riders").select("*").eq("sunday_date", selectedSunday).order("created_at"),
    supabase.from("audit_logs").select("*").eq("sunday_date", selectedSunday).order("created_at", { ascending: false }).limit(100),
    supabase
      .from("reminder_runs")
      .select("*")
      .eq("sunday_date", selectedSunday)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const driverRows = (drivers as Driver[] | null) ?? [];
  const riderRows = (riders as Rider[] | null) ?? [];
  const logRows = (auditLogs as AuditLog[] | null) ?? [];
  const reminderRows = (reminderRuns as ReminderRun[] | null) ?? [];

  const driverCards = buildDriverCards(driverRows, riderRows);
  const summary = buildSummary(driverRows, riderRows);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <AppHeader
        profile={profile}
        title="Weekly History"
        subtitle="Review past Sundays, assignments, reminders, and admin activity."
      />

      <SectionCard title="Choose Sunday" description="Switch between current and past Sunday cycles.">
        <form className="grid gap-3 sm:grid-cols-[320px_auto]" method="get">
          <select
            name="sunday_date"
            defaultValue={selectedSunday}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {[selectedSunday, ...sundayOptions]
              .filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)
              .map((value) => (
                <option key={value} value={value}>
                  {formatServiceSunday(value)}
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            View history
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title={`Snapshot: ${formatServiceSunday(selectedSunday)}`}
        description="Summary of driver capacity, rider statuses, and assignment outcomes."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Drivers</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.totalDrivers}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Riders</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.totalRiders}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmed</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.confirmedRiders}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Coordinating</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.coordinatingRiders}</p>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Assignments" description="Driver-by-driver assignment record for the selected Sunday.">
        {driverCards.length === 0 ? (
          <p className="text-sm text-slate-600">No driver records for this Sunday.</p>
        ) : (
          <div className="space-y-3">
            {driverCards.map((driver) => (
              <article key={driver.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {driver.full_name} • {driver.pickup_location} {driver.pickup_time}
                  </p>
                  <StatusBadge
                    label={`${driver.seatsFilled}/${driver.available_seats} filled`}
                    tone={driver.seatsRemaining > 0 ? "green" : "red"}
                  />
                </div>
                <p className="text-sm text-slate-700">Phone: {formatPhoneForDisplay(driver.phone)}</p>
                <p className="text-sm text-slate-700">Notes: {formatNullable(driver.notes)}</p>

                <div className="mt-2 space-y-1 text-sm text-slate-700">
                  {driver.riders.length === 0 ? (
                    <p>No riders assigned.</p>
                  ) : (
                    driver.riders.map((rider) => (
                      <p key={rider.id}>
                        {rider.full_name} • {formatPhoneForDisplay(rider.phone)} • {rider.selected_time}
                      </p>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Reminder Runs" description="Automated or manual reminder activity for this Sunday.">
        {reminderRows.length === 0 ? (
          <p className="text-sm text-slate-600">No reminder runs logged yet.</p>
        ) : (
          <div className="space-y-2">
            {reminderRows.map((run) => (
              <article key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={`${run.reminder_group} • ${run.status}`}
                    tone={run.status === "sent" ? "green" : run.status === "failed" ? "red" : "amber"}
                  />
                  <span>{new Date(run.created_at).toLocaleString()}</span>
                </div>
                <p>
                  Source: {run.trigger_source} • Sent: {run.sent_count}/{run.recipient_count}
                </p>
                <p>{formatNullable(run.message)}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Audit Log" description="Track who changed matching, roles, scheduling, and records.">
        {logRows.length === 0 ? (
          <p className="text-sm text-slate-600">No audit entries for this Sunday.</p>
        ) : (
          <div className="space-y-2">
            {logRows.map((log) => (
              <article key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {log.action} • {log.entity_type}
                  {log.entity_id ? ` (${log.entity_id})` : ""}
                </p>
                <p>
                  By {log.actor_email} at {new Date(log.created_at).toLocaleString()}
                </p>
                {Object.keys(log.details ?? {}).length > 0 ? (
                  <pre className="mt-1 overflow-auto rounded-lg bg-white p-2 text-xs text-slate-600">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </main>
  );
}
