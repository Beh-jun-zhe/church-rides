const SERVICE_TIMEZONE = "America/New_York";

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fallbackCurrentServiceSunday(now = new Date()) {
  const zonedNow = new Date(now.toLocaleString("en-US", { timeZone: SERVICE_TIMEZONE }));
  const daysUntilSunday = (7 - zonedNow.getDay()) % 7;
  return toIsoDate(addDays(zonedNow, daysUntilSunday));
}

export async function getCurrentServiceSunday(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
) {
  const { data, error } = await supabase.rpc("current_service_sunday");

  if (error || !data) {
    return fallbackCurrentServiceSunday();
  }

  return data as string;
}

export function formatServiceSunday(dateIso: string) {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
