import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ownerEmail } from "@/lib/env";
import { normalizeEmail } from "@/lib/utils";
import type { AdminStatus, AppRole, Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

interface SessionContext {
  user: User;
  profile: Profile;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

function computeSeedRole(email: string) {
  return email === ownerEmail && ownerEmail ? ("owner" as const) : ("rider" as const);
}

function computeSeedAdminStatus(role: AppRole): AdminStatus {
  if (role === "owner") return "approved";
  return "not_requested";
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
): Promise<Profile> {
  const normalizedEmail = normalizeEmail(user.email);
  const seededRole = computeSeedRole(normalizedEmail);
  const { data: existingProfile, error: lookupError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!existingProfile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? "",
      role: seededRole,
      admin_status: computeSeedAdminStatus(seededRole),
    });

    if (insertError) {
      throw new Error(insertError.message);
    }
  } else if (existingProfile.email !== user.email) {
    const { error: emailUpdateError } = await supabase
      .from("profiles")
      .update({ email: user.email ?? "" })
      .eq("id", user.id);

    if (emailUpdateError) {
      throw new Error(emailUpdateError.message);
    }
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load profile.");
  }

  if (normalizedEmail === ownerEmail && data.role !== "owner") {
    await supabase
      .from("profiles")
      .update({ role: "owner", admin_status: "approved" })
      .eq("id", user.id);

    const { data: ownerProfile, error: ownerError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (ownerError || !ownerProfile) {
      throw new Error(ownerError?.message ?? "Unable to update owner profile.");
    }

    return ownerProfile as Profile;
  }

  return data as Profile;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await ensureProfile(supabase, user);

  return { user, profile, supabase };
}

export async function requireAuth(nextPath?: string): Promise<SessionContext> {
  const context = await getSessionContext();

  if (!context) {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${next}`);
  }

  return context;
}

export function isApprovedAdmin(profile: Profile) {
  return profile.role === "owner" || (profile.role === "admin" && profile.admin_status === "approved");
}

export async function requireDriver(nextPath = "/driver") {
  const context = await requireAuth(nextPath);

  if (context.profile.role !== "driver") {
    redirect("/forbidden");
  }

  return context;
}

export async function requireRider(nextPath = "/rider") {
  const context = await requireAuth(nextPath);

  if (context.profile.role !== "rider") {
    redirect("/forbidden");
  }

  return context;
}

export async function requireAdmin(nextPath = "/admin") {
  const context = await requireAuth(nextPath);

  if (!isApprovedAdmin(context.profile)) {
    redirect("/forbidden");
  }

  return context;
}

export async function requireOwner(nextPath = "/owner") {
  const context = await requireAuth(nextPath);

  if (context.profile.role !== "owner") {
    redirect("/forbidden");
  }

  return context;
}

export function routeForProfile(profile: Profile) {
  if (profile.role === "owner") return "/owner";
  if (profile.role === "admin") {
    return profile.admin_status === "approved" ? "/admin" : "/onboarding";
  }
  if (profile.role === "driver") return "/driver";
  return "/rider";
}
