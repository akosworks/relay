import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side only. The service role key bypasses RLS, so this must never be
 * imported by anything that ships to the client — every caller filters by
 * `user_id` itself, since there are no RLS policies yet (see lib/user.ts).
 */
const CACHE_KEY = Symbol.for("relay.supabase");

type Global = typeof globalThis & { [CACHE_KEY]?: SupabaseClient | null };

/** True when Supabase env vars are present; callers use this to pick a storage provider. */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Returns null when unconfigured so callers can fall back to the in-memory provider. */
export function getSupabase(): SupabaseClient | null {
  const g = globalThis as Global;
  if (g[CACHE_KEY] !== undefined) return g[CACHE_KEY];

  if (!supabaseConfigured()) {
    g[CACHE_KEY] = null;
    return null;
  }

  g[CACHE_KEY] = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return g[CACHE_KEY];
}
