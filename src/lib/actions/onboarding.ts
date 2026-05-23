"use server";

import { redirect } from "next/navigation";
import { requireAuth, routeForProfile } from "@/lib/auth";
import { setFlashMessage } from "@/lib/flash";

export async function submitOnboardingChoice(formData: FormData) {
  const { profile, supabase } = await requireAuth("/onboarding");
  const choice = formData.get("role_choice")?.toString();

  if (!choice) {
    return;
  }

  const updatePayload: {
    role?: "rider" | "driver" | "admin";
    admin_status?: "not_requested" | "pending";
  } = {};

  if (choice === "rider") {
    updatePayload.role = "rider";
    updatePayload.admin_status = "not_requested";
  }

  if (choice === "driver") {
    updatePayload.role = "driver";
    updatePayload.admin_status = "not_requested";
  }

  if (choice === "admin") {
    updatePayload.role = "admin";
    updatePayload.admin_status = "pending";
  }

  if (!updatePayload.role) {
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to update profile role.");
  }

  redirect(routeForProfile(data));
}

export async function switchSelfRole(formData: FormData) {
  const { profile, supabase } = await requireAuth("/onboarding");
  const targetRole = formData.get("target_role")?.toString();

  if (targetRole !== "rider" && targetRole !== "driver") {
    return;
  }

  if (profile.role === "owner") {
    await setFlashMessage({ tone: "error", text: "Owner role cannot be switched." });
    redirect("/owner");
  }

  const destination = targetRole === "rider" ? "/rider" : "/driver";
  if (profile.role === targetRole) {
    await setFlashMessage({ tone: "info", text: `You are already in ${targetRole} mode.` });
    redirect(destination);
  }

  const { error } = await supabase
    .from("profiles")
    .update({ role: targetRole, admin_status: "not_requested" })
    .eq("id", profile.id);

  if (error) {
    await setFlashMessage({
      tone: "error",
      text: error.message || "Unable to switch roles right now.",
    });
    redirect(routeForProfile(profile));
  }

  const roleLabel = targetRole === "rider" ? "Rider" : "Driver";
  await setFlashMessage({ tone: "success", text: `Switched to ${roleLabel} role.` });
  redirect(destination);
}
