const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY?.trim() ?? "",
  REMINDER_FROM_EMAIL: process.env.REMINDER_FROM_EMAIL?.trim() ?? "",
  CRON_SECRET: process.env.CRON_SECRET?.trim() ?? "",
  APP_BASE_URL: process.env.APP_BASE_URL?.trim() ?? "",
};

export const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
