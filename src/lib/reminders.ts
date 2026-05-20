import { env } from "@/lib/env";
import { formatServiceSunday, getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReminderGroup = "drivers" | "riders";
export type ReminderSource = "manual" | "cron";

interface DispatchRemindersInput {
  supabase: SupabaseClient;
  group: ReminderGroup;
  source: ReminderSource;
  triggeredBy?: string | null;
}

interface ReminderRecipient {
  email: string;
  full_name: string | null;
}

function reminderCopy(group: ReminderGroup, sundayLabel: string, loginUrl: string) {
  if (group === "drivers") {
    return {
      subject: `Driver reminder: submit your availability for ${sundayLabel}`,
      html: `
        <p>Hi there,</p>
        <p>This is a friendly reminder to submit your driver availability for <strong>${sundayLabel}</strong>.</p>
        <p>Please update your seats, location, and time slot so matching stays smooth for everyone.</p>
        <p><a href="${loginUrl}">Open Church Ride Link</a></p>
        <p>Thank you for serving the community.</p>
      `,
    };
  }

  return {
    subject: `Rider reminder: submit your request for ${sundayLabel}`,
    html: `
      <p>Hi there,</p>
      <p>This is a friendly reminder to submit your ride request for <strong>${sundayLabel}</strong>.</p>
      <p>If you already submitted, you can log in to check your status.</p>
      <p><a href="${loginUrl}">Open Church Ride Link</a></p>
      <p>Final details are coordinated by Saturday noon.</p>
    `,
  };
}

function resolveLoginUrl() {
  const base = env.APP_BASE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/login`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.REMINDER_FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email send failed: ${response.status} ${detail}`);
  }
}

async function fetchRecipients(
  supabase: SupabaseClient,
  group: ReminderGroup,
): Promise<ReminderRecipient[]> {
  const role = group === "drivers" ? "driver" : "rider";
  const { data, error } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("role", role)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return ((data as ReminderRecipient[] | null) ?? []).filter((row) => row.email?.trim());
}

async function insertRun(
  supabase: SupabaseClient,
  payload: {
  sundayDate: string;
  group: ReminderGroup;
  source: ReminderSource;
  triggeredBy?: string | null;
  recipientCount: number;
  sentCount: number;
  status: "sent" | "skipped" | "failed";
  message?: string;
},
) {
  await supabase.from("reminder_runs").insert({
    sunday_date: payload.sundayDate,
    reminder_group: payload.group,
    trigger_source: payload.source,
    triggered_by: payload.triggeredBy ?? null,
    recipient_count: payload.recipientCount,
    sent_count: payload.sentCount,
    status: payload.status,
    message: payload.message ?? null,
  });
}

export async function dispatchReminders({ supabase, group, source, triggeredBy }: DispatchRemindersInput) {
  const sundayDate = await getCurrentServiceSunday(supabase);
  const sundayLabel = formatServiceSunday(sundayDate);
  const recipients = await fetchRecipients(supabase, group);

  if (!env.RESEND_API_KEY || !env.REMINDER_FROM_EMAIL) {
    const msg = "Reminder email skipped because RESEND_API_KEY or REMINDER_FROM_EMAIL is missing.";
    await insertRun(supabase, {
      sundayDate,
      group,
      source,
      triggeredBy,
      recipientCount: recipients.length,
      sentCount: 0,
      status: "skipped",
      message: msg,
    });
    return { ok: false, status: "skipped" as const, message: msg, recipients: recipients.length, sent: 0 };
  }

  if (recipients.length === 0) {
    const msg = `No ${group} recipients found.`;
    await insertRun(supabase, {
      sundayDate,
      group,
      source,
      triggeredBy,
      recipientCount: 0,
      sentCount: 0,
      status: "skipped",
      message: msg,
    });
    return { ok: true, status: "skipped" as const, message: msg, recipients: 0, sent: 0 };
  }

  const loginUrl = resolveLoginUrl();
  const copy = reminderCopy(group, sundayLabel, loginUrl);
  let sentCount = 0;
  const failedEmails: string[] = [];

  for (const recipient of recipients) {
    const helloName = recipient.full_name?.trim() || "friend";
    const html = copy.html.replace("Hi there", `Hi ${helloName}`);

    try {
      await sendEmail(recipient.email, copy.subject, html);
      sentCount += 1;
    } catch {
      failedEmails.push(recipient.email);
    }
  }

  const status = sentCount === recipients.length ? "sent" : "failed";
  const message =
    failedEmails.length > 0
      ? `Sent ${sentCount}/${recipients.length}. Failed: ${failedEmails.slice(0, 5).join(", ")}`
      : `Sent ${sentCount}/${recipients.length}.`;

  await insertRun(supabase, {
    sundayDate,
    group,
    source,
    triggeredBy,
    recipientCount: recipients.length,
    sentCount,
    status,
    message,
  });

  return { ok: sentCount > 0, status, message, recipients: recipients.length, sent: sentCount };
}

export function reminderGroupForToday(date = new Date()): ReminderGroup | null {
  const day = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" })).getDay();
  if (day === 4) return "drivers"; // Thursday
  if (day === 6) return "riders"; // Saturday
  return null;
}
