"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { setFlashMessage } from "@/lib/flash";
import { dispatchReminders } from "@/lib/reminders";
import { getCurrentServiceSunday } from "@/lib/serviceWeek";

function refreshEverything() {
  revalidatePath("/owner");
  revalidatePath("/admin");
  revalidatePath("/driver");
  revalidatePath("/rider");
  revalidatePath("/history");
  revalidatePath("/onboarding");
}

export async function approveAdminRequest(formData: FormData) {
  const { profile, supabase } = await requireOwner("/owner");
  const profileId = formData.get("profile_id")?.toString();

  if (!profileId) return;

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin", admin_status: "approved" })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: "admin_request_approved",
    entityType: "profiles",
    entityId: profileId,
    sundayDate: await getCurrentServiceSunday(supabase),
  });

  await setFlashMessage({ tone: "success", text: "Admin access approved." });

  refreshEverything();
}

export async function rejectAdminRequest(formData: FormData) {
  const { profile, supabase } = await requireOwner("/owner");
  const profileId = formData.get("profile_id")?.toString();

  if (!profileId) return;

  const { error } = await supabase
    .from("profiles")
    .update({ role: "rider", admin_status: "rejected" })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: "admin_request_rejected",
    entityType: "profiles",
    entityId: profileId,
    sundayDate: await getCurrentServiceSunday(supabase),
  });

  await setFlashMessage({ tone: "success", text: "Admin request rejected." });

  refreshEverything();
}

export async function updateUserRole(formData: FormData) {
  const { profile: ownerProfile, supabase } = await requireOwner("/owner");

  const profileId = formData.get("profile_id")?.toString();
  const role = formData.get("role")?.toString() as "rider" | "driver" | "admin" | "owner" | undefined;

  if (!profileId || !role) {
    return;
  }

  if (profileId === ownerProfile.id || role === "owner") {
    throw new Error("Owner role cannot be reassigned.");
  }

  const adminStatus = role === "admin" ? "approved" : "not_requested";

  const { error } = await supabase
    .from("profiles")
    .update({ role, admin_status: adminStatus })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: ownerProfile.id, email: ownerProfile.email },
    action: "user_role_updated",
    entityType: "profiles",
    entityId: profileId,
    sundayDate: await getCurrentServiceSunday(supabase),
    details: { role, adminStatus },
  });

  await setFlashMessage({ tone: "success", text: "User role updated." });

  refreshEverything();
}

export async function toggleScheduleLock(formData: FormData) {
  const { profile, supabase } = await requireOwner("/owner");
  const lock = formData.get("lock")?.toString() === "true";

  const { error } = await supabase
    .from("system_settings")
    .update({ schedule_locked: lock, updated_by: profile.id })
    .eq("id", true);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: lock ? "schedule_locked" : "schedule_unlocked",
    entityType: "system_settings",
    entityId: "true",
    sundayDate: await getCurrentServiceSunday(supabase),
  });

  await setFlashMessage({ tone: "success", text: lock ? "Schedule locked." : "Schedule unlocked." });

  refreshEverything();
}

export async function sendDriverRemindersNow() {
  const { profile, supabase } = await requireOwner("/owner");
  const result = await dispatchReminders({
    supabase,
    group: "drivers",
    source: "manual",
    triggeredBy: profile.id,
  });

  const tone = result.status === "failed" ? "error" : result.status === "skipped" ? "info" : "success";
  await setFlashMessage({ tone, text: `Driver reminders: ${result.message}` });
  refreshEverything();
}

export async function sendRiderRemindersNow() {
  const { profile, supabase } = await requireOwner("/owner");
  const result = await dispatchReminders({
    supabase,
    group: "riders",
    source: "manual",
    triggeredBy: profile.id,
  });

  const tone = result.status === "failed" ? "error" : result.status === "skipped" ? "info" : "success";
  await setFlashMessage({ tone, text: `Rider reminders: ${result.message}` });

  refreshEverything();
}
