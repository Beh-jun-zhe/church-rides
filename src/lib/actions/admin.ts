"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { FLEXIBLE_TIME_SLOT } from "@/lib/constants";
import { setFlashMessage } from "@/lib/flash";
import { normalizePhone } from "@/lib/phone";
import { getCurrentServiceSunday } from "@/lib/serviceWeek";
import { toInteger } from "@/lib/utils";
import type { PickupLocation } from "@/lib/types";

function refreshAllDashboards() {
  revalidatePath("/admin");
  revalidatePath("/owner");
  revalidatePath("/driver");
  revalidatePath("/rider");
}

async function assignRiderByOwnerOverride({
  supabase,
  riderId,
  driverId,
  ownerId,
}: {
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"];
  riderId: string;
  driverId: string;
  ownerId: string;
}) {
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const [{ data: rider, error: riderError }, { data: driver, error: driverError }] = await Promise.all([
    supabase.from("riders").select("id, sunday_date").eq("id", riderId).maybeSingle(),
    supabase
      .from("drivers")
      .select("id, active, available_seats, pickup_location, pickup_time, sunday_date")
      .eq("id", driverId)
      .maybeSingle(),
  ]);

  if (riderError || !rider) {
    throw new Error(riderError?.message ?? "Rider not found.");
  }

  if (driverError || !driver || !driver.active) {
    throw new Error(driverError?.message ?? "Driver not found or inactive.");
  }

  if (rider.sunday_date !== serviceSunday || driver.sunday_date !== serviceSunday) {
    throw new Error("Owner override can only assign records from the current Sunday board.");
  }

  const { count, error: countError } = await supabase
    .from("riders")
    .select("id", { head: true, count: "exact" })
    .eq("assigned_driver_id", driver.id)
    .eq("status", "assigned")
    .eq("sunday_date", serviceSunday)
    .neq("id", riderId);

  if (countError) {
    throw new Error(countError.message);
  }

  const assignedCount = count ?? 0;
  if (assignedCount >= driver.available_seats) {
    throw new Error("Driver has no remaining seats.");
  }

  const { error: riderUpdateError } = await supabase
    .from("riders")
    .update({
      assigned_driver_id: driver.id,
      pickup_location: driver.pickup_location as PickupLocation,
      selected_time: driver.pickup_time,
      status: "assigned",
    })
    .eq("id", riderId);

  if (riderUpdateError) {
    throw new Error(riderUpdateError.message);
  }

  const { error: assignmentError } = await supabase.from("ride_assignments").upsert(
    {
      driver_id: driver.id,
      rider_id: riderId,
      sunday_date: serviceSunday,
      assigned_by: ownerId,
      assignment_method: "manual",
    },
    { onConflict: "rider_id" },
  );

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }
}

export async function moveRiderAssignment(
  riderId: string,
  targetDriverId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { profile, supabase } = await requireAdmin("/admin");
    const serviceSunday = await getCurrentServiceSunday(supabase);

    if (!riderId) {
      return { ok: false, error: "Missing rider id." };
    }

    if (!targetDriverId) {
      const { error } = await supabase.rpc("unassign_rider", {
        target_rider_id: riderId,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      await logAuditEvent(supabase, {
        actor: { id: profile.id, email: profile.email },
        action: "rider_unassigned",
        entityType: "riders",
        entityId: riderId,
        sundayDate: serviceSunday,
      });
    } else {
      if (profile.role === "owner") {
        await assignRiderByOwnerOverride({
          supabase,
          riderId,
          driverId: targetDriverId,
          ownerId: profile.id,
        });
      } else {
        const { error } = await supabase.rpc("assign_rider_to_driver", {
          target_rider_id: riderId,
          target_driver_id: targetDriverId,
          method: "manual",
        });

        if (error) {
          return { ok: false, error: error.message };
        }
      }

      await logAuditEvent(supabase, {
        actor: { id: profile.id, email: profile.email },
        action: "rider_assigned",
        entityType: "riders",
        entityId: riderId,
        sundayDate: serviceSunday,
        details: { targetDriverId },
      });
    }

    refreshAllDashboards();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to update rider assignment.",
    };
  }
}

export async function runAutoMatch() {
  const { profile, supabase } = await requireAdmin("/admin");
  const serviceSunday = await getCurrentServiceSunday(supabase);

  const { error } = await supabase.rpc("run_auto_match");

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: "auto_match_run",
    entityType: "matching",
    sundayDate: serviceSunday,
  });

  refreshAllDashboards();
}

export async function assignRiderToDriver(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  const serviceSunday = await getCurrentServiceSunday(supabase);

  const riderId = formData.get("rider_id")?.toString();
  const driverId = formData.get("driver_id")?.toString();

  if (!riderId || !driverId) {
    return;
  }

  if (profile.role === "owner") {
    await assignRiderByOwnerOverride({
      supabase,
      riderId,
      driverId,
      ownerId: profile.id,
    });
  } else {
    const { error } = await supabase.rpc("assign_rider_to_driver", {
      target_rider_id: riderId,
      target_driver_id: driverId,
      method: "manual",
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: "rider_assigned",
    entityType: "riders",
    entityId: riderId,
    sundayDate: serviceSunday,
    details: { targetDriverId: driverId, source: "legacy_form" },
  });

  refreshAllDashboards();
}

export async function unassignRider(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const riderId = formData.get("rider_id")?.toString();

  if (!riderId) {
    return;
  }

  const { error } = await supabase.rpc("unassign_rider", {
    target_rider_id: riderId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: "rider_unassigned",
    entityType: "riders",
    entityId: riderId,
    sundayDate: serviceSunday,
    details: { source: "legacy_form" },
  });

  refreshAllDashboards();
}

export async function updateRiderAdminNote(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  const serviceSunday = await getCurrentServiceSunday(supabase);
  const riderId = formData.get("rider_id")?.toString();
  const note = formData.get("admin_note")?.toString().trim() ?? "";

  if (!riderId) {
    return;
  }

  const { error } = await supabase.from("riders").update({ admin_note: note }).eq("id", riderId);

  if (error) {
    throw new Error(error.message);
  }

  await logAuditEvent(supabase, {
    actor: { id: profile.id, email: profile.email },
    action: "rider_admin_note_updated",
    entityType: "riders",
    entityId: riderId,
    sundayDate: serviceSunday,
  });

  await setFlashMessage({ tone: "success", text: "Coordination note saved." });

  refreshAllDashboards();
}

export async function upsertDriverForUser(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  try {
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const userId = formData.get("user_id")?.toString().trim() ?? "";
    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const phoneInput = formData.get("phone")?.toString().trim() ?? "";
    const pickupLocation = formData.get("pickup_location")?.toString().trim() ?? "";
    const pickupTime = formData.get("pickup_time")?.toString().trim() ?? "";
    const availableSeats = toInteger(formData.get("available_seats"), 0);
    const notes = formData.get("notes")?.toString().trim() ?? "";
    const phone = normalizePhone(phoneInput);

    if (!userId || !fullName || !phone || !pickupLocation || !pickupTime || availableSeats < 1) {
      throw new Error("Please complete all required driver fields with a valid phone number.");
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !targetProfile) {
      throw new Error(profileError?.message ?? "Selected user was not found.");
    }

    if (targetProfile.role === "owner") {
      throw new Error("Owner profile cannot be assigned as a driver.");
    }

    const { error } = await supabase.from("drivers").upsert(
      {
        user_id: userId,
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

    if (profile.role === "owner" && targetProfile.role !== "driver") {
      await supabase.from("profiles").update({ role: "driver", admin_status: "not_requested" }).eq("id", userId);
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "driver_record_upserted",
      entityType: "drivers",
      entityId: userId,
      sundayDate: serviceSunday,
      details: { pickupLocation, pickupTime, availableSeats },
    });

    await setFlashMessage({ tone: "success", text: "Driver record saved." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to save driver record right now.",
    });
  }

  refreshAllDashboards();
}

export async function upsertRiderForUser(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  try {
    const serviceSunday = await getCurrentServiceSunday(supabase);

    const userId = formData.get("user_id")?.toString().trim() ?? "";
    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const phoneInput = formData.get("phone")?.toString().trim() ?? "";
    const pickupLocation = formData.get("pickup_location")?.toString().trim() ?? "";
    const selectedTime = formData.get("selected_time")?.toString().trim() ?? "";
    const notes = formData.get("notes")?.toString().trim() ?? "";
    const phone = normalizePhone(phoneInput);

    if (!userId || !fullName || !phone || !pickupLocation) {
      throw new Error("Please complete all required rider fields with a valid phone number.");
    }

    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !targetProfile) {
      throw new Error(profileError?.message ?? "Selected user was not found.");
    }

    if (targetProfile.role === "owner") {
      throw new Error("Owner profile cannot be assigned as a rider.");
    }

    const { data: slots, error: slotsError } = await supabase.rpc("available_driver_slots");

    if (slotsError) {
      throw new Error(slotsError.message);
    }

    const locationSlots = (
      slots as Array<{ pickup_location: string; pickup_time: string }> | null | undefined
    )?.filter((slot) => slot.pickup_location === pickupLocation) ?? [];

    let resolvedSelectedTime = selectedTime || FLEXIBLE_TIME_SLOT;

    if (locationSlots.length === 0) {
      resolvedSelectedTime = FLEXIBLE_TIME_SLOT;
    } else {
      const slotMatch = locationSlots.some((slot) => slot.pickup_time === selectedTime);
      if (!slotMatch) {
        throw new Error("Selected rider time slot is not currently offered by an active driver.");
      }
    }

    const { data: upsertedRider, error: riderError } = await supabase
      .from("riders")
      .upsert(
        {
          user_id: userId,
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
      )
      .select("id")
      .single();

    if (riderError || !upsertedRider) {
      throw new Error(riderError?.message ?? "Unable to create or update rider.");
    }

    await supabase.from("ride_assignments").delete().eq("rider_id", upsertedRider.id);

    if (profile.role === "owner" && targetProfile.role !== "rider") {
      await supabase.from("profiles").update({ role: "rider", admin_status: "not_requested" }).eq("id", userId);
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: "rider_record_upserted",
      entityType: "riders",
      entityId: userId,
      sundayDate: serviceSunday,
      details: { pickupLocation, selectedTime: resolvedSelectedTime },
    });

    await setFlashMessage({ tone: "success", text: "Rider request saved." });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to save rider request right now.",
    });
  }

  refreshAllDashboards();
}

export async function removeRiderRequest(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  try {
    const serviceSunday = await getCurrentServiceSunday(supabase);
    const riderId = formData.get("rider_id")?.toString().trim() ?? "";
    const removeMode = formData.get("remove_mode")?.toString().trim() ?? "remove_only";

    if (!riderId) {
      return;
    }

    const { error: riderError } = await supabase
      .from("riders")
      .update({ status: "cancelled", assigned_driver_id: null })
      .eq("id", riderId);

    if (riderError) {
      throw new Error(riderError.message);
    }

    const { error: assignmentError } = await supabase.from("ride_assignments").delete().eq("rider_id", riderId);

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }

    if (removeMode === "rematch") {
      const { error: rematchError } = await supabase.rpc("run_auto_match");
      if (rematchError) {
        throw new Error(rematchError.message);
      }
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: removeMode === "rematch" ? "rider_removed_and_rematched" : "rider_removed",
      entityType: "riders",
      entityId: riderId,
      sundayDate: serviceSunday,
    });

    await setFlashMessage({
      tone: "success",
      text:
        removeMode === "rematch"
          ? "Rider request removed and auto-match re-ran."
          : "Rider request removed for this Sunday.",
    });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to remove rider request right now.",
    });
  }

  refreshAllDashboards();
}

export async function removeDriverAvailability(formData: FormData) {
  const { profile, supabase } = await requireAdmin("/admin");
  try {
    const serviceSunday = await getCurrentServiceSunday(supabase);
    const driverId = formData.get("driver_id")?.toString().trim() ?? "";
    const removeMode = formData.get("remove_mode")?.toString().trim() ?? "remove_only";

    if (!driverId) {
      return;
    }

    const { error: unassignError } = await supabase
      .from("riders")
      .update({ status: "pending_assignment", assigned_driver_id: null })
      .eq("assigned_driver_id", driverId)
      .eq("status", "assigned");

    if (unassignError) {
      throw new Error(unassignError.message);
    }

    const { error: assignmentError } = await supabase.from("ride_assignments").delete().eq("driver_id", driverId);

    if (assignmentError) {
      throw new Error(assignmentError.message);
    }

    const { error: driverError } = await supabase.from("drivers").delete().eq("id", driverId);

    if (driverError) {
      throw new Error(driverError.message);
    }

    if (removeMode === "rematch") {
      const { error: rematchError } = await supabase.rpc("run_auto_match");
      if (rematchError) {
        throw new Error(rematchError.message);
      }
    }

    await logAuditEvent(supabase, {
      actor: { id: profile.id, email: profile.email },
      action: removeMode === "rematch" ? "driver_removed_and_rematched" : "driver_removed",
      entityType: "drivers",
      entityId: driverId,
      sundayDate: serviceSunday,
    });

    await setFlashMessage({
      tone: "success",
      text:
        removeMode === "rematch"
          ? "Driver availability removed and auto-match re-ran."
          : "Driver availability removed for this Sunday.",
    });
  } catch (error) {
    await setFlashMessage({
      tone: "error",
      text: error instanceof Error ? error.message : "Unable to remove driver availability right now.",
    });
  }

  refreshAllDashboards();
}
