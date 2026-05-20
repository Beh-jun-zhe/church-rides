import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { dispatchReminders, reminderGroupForToday } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

function authorized(request: Request) {
  if (!env.CRON_SECRET) return false;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  return token === env.CRON_SECRET || headerSecret === env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const group = reminderGroupForToday();
  if (!group) {
    return NextResponse.json({
      ok: true,
      status: "skipped",
      message: "No reminder schedule for today. Cron should run Thursday/Saturday.",
    });
  }

  try {
    const supabase = createAdminClient();
    const result = await dispatchReminders({
      supabase,
      group,
      source: "cron",
      triggeredBy: null,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Cron reminder job failed.",
      },
      { status: 500 },
    );
  }
}
