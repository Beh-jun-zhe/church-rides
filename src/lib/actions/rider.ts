"use server";

import { revalidatePath } from "next/cache";
import { requireRider } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { FLEXIBLE_TIME_SLOT } from "@/lib/constants";
import { setFlashMessage } from "@/lib/flash";
import { normalizePhone } from "@/lib/phone";
import { getCurrentServiceSunday } from "@/lib/serviceWeek";

async function checkScheduleLock(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
) {
  const { data, error } = await supabase.rpc("is_schedule_locked_now");

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    throw new Error("Schedule is currently locked. Please contact an admin for support.");
  }
}

function resolveSelectedTimeForLocation({
  pickupLocation,
  selectedTime,
  slotRows,
}: {
  pickupLocation: string;
  selectedTime: string;
  slotRows: Array<{ pickup_location: string; pickup_time: string }> | null | undefined;
}) {
  const locationSlots = (slotRows ?? []).filter((slot) => slot.pickup_location === pickupLocation);
  let resolvedSelectedTime = selectedTime || FLEXIBLE_TIME_SLOT;

  if (locationSlots.length === 0) {
    resolvedSelectedTime = FLEXIBLE_TIME_SLOT;
  } else {
    const slotExists = locationSlots.some((slot) => slot.pickup_time === selectedTime);
    if (!slotExists) {
      throw new Error("That pickup slot is no longer available. Please choose another option.");
    }
  }

  if (!resolvedSelectedTime) {
    throw new Error("That pickup slot is no longer available. Please choose another option.");
  }

  return resolvedSelectedTime;
}

export async function upsertRiderRequest(formData: FormData) {
  const { profile, supabase } = await requireRider("/rider");
  try {
    await checkScheduleLock(supabase);
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const phoneInput = formData.get("phone")?.toString().trim() ?? "";
    const pickupLocation = formData.get("pickup_location")?.toString().trim() ?? "";
    const selectedTime = formData.get("selected_time")?.toString().trim() ?? "";
    const notes = formData.get("notes")?.toString().trim() ?? "";
    const phone = normalizePhone(phoneInput);

    if (!fullName || !phone || !pickupLocation) {
      throw new Error("Please complete all required fields with a valid phone number.");
    }

    const { data: slotRows, error: slotError } = await supabase.rpc("available_driver_slots");

    if (slotError) {
      throw new Error(slotError.message);
    }

    const resolvedSelectedTime = resolveSelectedTimeForLocation({
      pickupLocation,
      selectedTime,
      slotRows: slotRows as Array<{ pickup_location: string; pickup_time: string }> | null | undefined,
    });

    const { data: existing, error: existingError } = await supabase
      .from("riders")
      .select("id")
      .eq("user_id", profile.id)
      .eq("sunday_date", serviceSunday)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    const { error } = await supabase.from("riders").upsert(
      {
        user_id: profile.id,
        sunday_date: serviceSunday,
        full_name: fullName,
        phone,
        pickup_location: pickupLocation,
        selected_time: resolvedSelectedTime,
        notes,
        status: "pending_assignment",
        assigned_driver_id: null,
      },
      { onConflict: "user_id,sunday_date" },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (existing?.id) {
      await supabase.from("ride_assignments").delete().eq("rider_id", existing.id);
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "rider_self_upserted",
      entityType: "riders",
      entityId: profile.id,
      sundayDate: serviceSunday,
      details: { pickupLocation, selectedTime: resolvedSelectedTime },
    });

    await setFlashMessage({ tone: "success", text: "Ride request saved." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to save ride request right now.",
    });
  }

  revalidatePath("/rider");
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/driver");
}

export async function cancelRiderRequest() {
  const { profile, supabase } = await requireRider("/rider");
  try {
    await checkScheduleLock(supabase);
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const { data: rider, error: findError } = await supabase
      .from("riders")
      .select("id")
      .eq("user_id", profile.id)
      .eq("sunday_date", serviceSunday)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (!rider) {
      return;
    }

    const { error } = await supabase
      .from("riders")
      .update({ status: "cancelled", assigned_driver_id: null })
      .eq("id", rider.id);

    if (error) {
      throw new Error(error.message);
    }

    await supabase.from("ride_assignments").delete().eq("rider_id", rider.id);

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "rider_self_cancelled",
      entityType: "riders",
      entityId: rider.id,
      sundayDate: serviceSunday,
    });

    await setFlashMessage({ tone: "success", text: "Ride request cancelled." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to cancel ride request right now.",
    });
  }

  revalidatePath("/rider");
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/driver");
}

export async function copyPreviousRiderRequest() {
  const { profile, supabase } = await requireRider("/rider");
  try {
    await checkScheduleLock(supabase);
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const [{ data: previous, error: previousError }, { data: slotRows, error: slotError }] = await Promise.all([
      supabase
        .from("riders")
        .select("full_name, phone, pickup_location, selected_time, notes")
        .eq("user_id", profile.id)
        .lt("sunday_date", serviceSunday)
        .neq("status", "cancelled")
        .order("sunday_date", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.rpc("available_driver_slots"),
    ]);

    if (previousError) {
      throw new Error(previousError.message);
    }

    if (!previous) {
      await setFlashMessage({ tone: "info", text: "No previous Sunday rider request was found to copy." });
      revalidatePath("/rider");
      return;
    }

    if (slotError) {
      throw new Error(slotError.message);
    }

    let resolvedSelectedTime = FLEXIBLE_TIME_SLOT;
    try {
      resolvedSelectedTime = resolveSelectedTimeForLocation({
        pickupLocation: previous.pickup_location,
        selectedTime: previous.selected_time,
        slotRows: slotRows as Array<{ pickup_location: string; pickup_time: string }> | null | undefined,
      });
    } catch {
      resolvedSelectedTime = FLEXIBLE_TIME_SLOT;
    }

    const { data: existing, error: existingError } = await supabase
      .from("riders")
      .select("id")
      .eq("user_id", profile.id)
      .eq("sunday_date", serviceSunday)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    const { error } = await supabase.from("riders").upsert(
      {
        user_id: profile.id,
        sunday_date: serviceSunday,
        full_name: previous.full_name,
        phone: previous.phone,
        pickup_location: previous.pickup_location,
        selected_time: resolvedSelectedTime,
        notes: previous.notes,
        status: "pending_assignment",
        assigned_driver_id: null,
        admin_note: null,
      },
      { onConflict: "user_id,sunday_date" },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (existing?.id) {
      await supabase.from("ride_assignments").delete().eq("rider_id", existing.id);
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "rider_self_copied_previous_week",
      entityType: "riders",
      entityId: profile.id,
      sundayDate: serviceSunday,
    });

    await setFlashMessage({ tone: "success", text: "Copied last Sunday rider request." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to copy previous rider request right now.",
    });
  }

  revalidatePath("/rider");
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/driver");
}
