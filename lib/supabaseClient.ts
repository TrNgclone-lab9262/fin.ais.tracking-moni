import { createClient, SupabaseClient } from "@supabase/supabase-js";

function readViteEnv(key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.[key]?.trim() || "";
  } catch {
    return "";
  }
}

const rawUrl = readViteEnv("VITE_SUPABASE_URL");
const rawAnonKey = readViteEnv("VITE_SUPABASE_ANON_KEY");

const hasValidUrl =
  rawUrl.startsWith("https://") &&
  !rawUrl.includes("your-project-id") &&
  rawUrl.length > 15;

const hasValidKey =
  rawAnonKey.length > 20 && !rawAnonKey.includes("your-supabase-anon-key");

export const isSupabaseConfigured = hasValidUrl && hasValidKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;
