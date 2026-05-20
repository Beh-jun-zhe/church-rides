import { getCurrentServiceSunday } from "@/lib/serviceWeek";
import type { Profile } from "@/lib/types";

type SupabaseClient = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

interface LogAuditInput {
  actor: Pick<Profile, "id" | "email">;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  sundayDate?: string;
}

export async function logAuditEvent(
  supabase: SupabaseClient,
  { actor, action, entityType, entityId, details, sundayDate }: LogAuditInput,
) {
  const targetSunday = sundayDate ?? (await getCurrentServiceSunday(supabase));

  await supabase.from("audit_logs").insert({
    sunday_date: targetSunday,
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    details: details ?? {},
  });
}
