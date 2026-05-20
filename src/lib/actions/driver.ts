"use server";

import { revalidatePath } from "next/cache";
import { requireDriver } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { setFlashMessage } from "@/lib/flash";
import { normalizePhone } from "@/lib/phone";
import { toInteger } from "@/lib/utils";
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

export async function upsertDriverAvailability(formData: FormData) {
  const { profile, supabase } = await requireDriver("/driver");
  try {
    await checkScheduleLock(supabase);
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const phoneInput = formData.get("phone")?.toString().trim() ?? "";
    const pickupLocation = formData.get("pickup_location")?.toString().trim() ?? "";
    const pickupTime = formData.get("pickup_time")?.toString().trim() ?? "";
    const availableSeats = toInteger(formData.get("available_seats"), 1);
    const notes = formData.get("notes")?.toString().trim() ?? "";

    const phone = normalizePhone(phoneInput);

    if (!fullName || !phone || !pickupLocation || !pickupTime || availableSeats < 1) {
      throw new Error("Please complete all required fields with a valid phone number.");
    }

    const { error } = await supabase.from("drivers").upsert(
      {
        user_id: profile.id,
        sunday_date: serviceSunday,
        full_name: fullName,
        phone,
        pickup_location: pickupLocation,
        pickup_time: pickupTime,
        available_seats: availableSeats,
        notes,
        active: true,
      },
      { onConflict: "user_id,sunday_date" },
    );

    if (error) {
      throw new Error(error.message);
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "driver_self_upserted",
      entityType: "drivers",
      entityId: profile.id,
      sundayDate: serviceSunday,
      details: { pickupLocation, pickupTime, availableSeats },
    });

    await setFlashMessage({ tone: "success", text: "Driver availability saved." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to save driver availability right now.",
    });
  }

  revalidatePath("/driver");
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/rider");
}

export async function copyPreviousDriverAvailability() {
  const { profile, supabase } = await requireDriver("/driver");
  try {
    await checkScheduleLock(supabase);
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const { data: previous, error: previousError } = await supabase
      .from("drivers")
      .select("full_name, phone, pickup_location, pickup_time, available_seats, notes, active")
      .eq("user_id", profile.id)
      .lt("sunday_date", serviceSunday)
      .order("sunday_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError) {
      throw new Error(previousError.message);
    }

    if (!previous) {
      await setFlashMessage({ tone: "info", text: "No previous Sunday driver record was found to copy." });
      revalidatePath("/driver");
      return;
    }

    const { error } = await supabase.from("drivers").upsert(
      {
        user_id: profile.id,
        sunday_date: serviceSunday,
        full_name: previous.full_name,
        phone: previous.phone,
        pickup_location: previous.pickup_location,
        pickup_time: previous.pickup_time,
        available_seats: previous.available_seats,
        notes: previous.notes,
        active: true,
      },
      { onConflict: "user_id,sunday_date" },
    );

    if (error) {
      throw new Error(error.message);
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "driver_self_copied_previous_week",
      entityType: "drivers",
      entityId: profile.id,
      sundayDate: serviceSunday,
    });

    await setFlashMessage({ tone: "success", text: "Copied last Sunday driver availability." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to copy previous driver availability right now.",
    });
  }

  revalidatePath("/driver");
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/rider");
}
