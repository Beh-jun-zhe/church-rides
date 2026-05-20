import {
  approveAdminRequest,
  rejectAdminRequest,
  sendDriverRemindersNow,
  sendRiderRemindersNow,
  toggleScheduleLock,
  updateUserRole,
} from "@/lib/actions/owner";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Profile, ReminderRun } from "@/lib/types";
import { formatNullable } from "@/lib/utils";

const roleOptions: Array<"rider" | "driver" | "admin"> = ["rider", "driver", "admin"];

export function OwnerControls({
  pendingAdmins,
  allUsers,
  scheduleLocked,
  recentReminderRuns,
}: {
  pendingAdmins: Profile[];
  allUsers: Profile[];
  scheduleLocked: boolean;
  recentReminderRuns: ReminderRun[];
}) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Schedule Lock"
        description="Owner can lock or unlock schedule updates for riders and drivers."
        right={
          <StatusBadge
            label={scheduleLocked ? "Schedule locked" : "Schedule open"}
            tone={scheduleLocked ? "red" : "green"}
          />
        }
      >
        <div className="flex flex-wrap gap-2">
          <form action={toggleScheduleLock}>
            <input type="hidden" name="lock" value="true" />
            <ConfirmSubmitButton
              label="Lock schedule"
              confirmText="Lock schedule now? Riders and drivers will not be able to edit requests until unlocked."
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
            />
          </form>
          <form action={toggleScheduleLock}>
            <input type="hidden" name="lock" value="false" />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Unlock schedule
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard
        title="Reminder Center"
        description="Send weekly reminder emails manually, plus optional cron automation in production."
      >
        <div className="flex flex-wrap gap-2">
          <form action={sendDriverRemindersNow}>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Send driver reminders now
            </button>
          </form>
          <form action={sendRiderRemindersNow}>
            <button
              type="submit"
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Send rider reminders now
            </button>
          </form>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent reminder runs</p>
          {recentReminderRuns.length === 0 ? (
            <p className="text-sm text-slate-600">No reminder runs yet for this Sunday.</p>
          ) : (
            recentReminderRuns.map((run) => (
              <article key={run.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  {run.reminder_group} • {run.status} • {new Date(run.created_at).toLocaleString()}
                </p>
                <p>
                  Source: {run.trigger_source} • Sent: {run.sent_count}/{run.recipient_count}
                </p>
                <p>{formatNullable(run.message)}</p>
              </article>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Pending Admin Requests" description="Approve or reject admin access requests.">
        {pendingAdmins.length === 0 ? (
          <p className="text-sm text-slate-600">No pending requests right now.</p>
        ) : (
          <div className="space-y-3">
            {pendingAdmins.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{request.email}</p>
                <p className="text-sm text-slate-600">Requested admin access.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveAdminRequest}>
                    <input type="hidden" name="profile_id" value={request.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                  </form>
                  <form action={rejectAdminRequest}>
                    <input type="hidden" name="profile_id" value={request.id} />
                    <ConfirmSubmitButton
                      label="Reject"
                      confirmText="Reject this admin request?"
                      className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    />
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="User Role Management" description="Owner can adjust roles except the owner role.">
        <div className="space-y-3">
          {allUsers.map((user) => (
            <article key={user.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2">
                <p className="font-semibold text-slate-900">{user.email}</p>
                <p className="text-sm text-slate-600">
                  Current role: {user.role} {user.role === "admin" ? `(${user.admin_status})` : ""}
                </p>
              </div>

              {user.role === "owner" ? (
                <p className="text-sm font-semibold text-slate-500">Owner role is fixed.</p>
              ) : (
                <form action={updateUserRole} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="profile_id" value={user.id} />
                  <select name="role" defaultValue={user.role} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <ConfirmSubmitButton
                    label="Update role"
                    confirmText="Update this user's role?"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  />
                </form>
              )}
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
