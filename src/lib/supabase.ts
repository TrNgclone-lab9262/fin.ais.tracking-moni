import { createClient, SupabaseClient } from "@supabase/supabase-js";

function readViteEnv(key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  try {
    const metaEnv = (
      import.meta as unknown as { env?: Record<string, string | undefined> }
    ).env;
    const fromVite = metaEnv?.[key]?.trim();
    if (fromVite) return fromVite;
  } catch {
    // Ignore when executed in pure Node context without Vite transform
  }

  try {
    if (typeof process !== "undefined" && process.env?.[key]) {
      return process.env[key]?.trim() || "";
    }
  } catch {
    // Ignore restricted process access in browser sandboxes
  }

  return "";
}

const supabaseUrl = readViteEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readViteEnv("VITE_SUPABASE_ANON_KEY");

const hasValidUrl =
  supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project-id") &&
  supabaseUrl.length > 15;

const hasValidKey =
  supabaseAnonKey.length > 20 &&
  !supabaseAnonKey.includes("your-supabase-anon-key");

export const isSupabaseConfigured: boolean = hasValidUrl && hasValidKey;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
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

export function requireSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase chưa được cấu hình. Hãy thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong biến môi trường."
    );
  }
  return supabase;
}
