import { getSupabase } from "@/lib/supabase/client";
import { createInMemoryStorage } from "./in-memory";
import { createSupabaseStorage } from "./providers/supabase";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

/**
 * One storage provider per process, cached on `globalThis` so the dev server's
 * hot reloads do not silently hand out a second, empty memory.
 *
 * Selecting a different provider (Postgres, a vector store, a graph database)
 * happens here and nowhere else. Supabase is used when configured; local dev
 * with no env vars set keeps working against the in-memory provider.
 */
const CACHE_KEY = Symbol.for("relay.storage");

type Global = typeof globalThis & { [CACHE_KEY]?: StorageProvider };

export function getStorage(): StorageProvider {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) {
    const db = getSupabase();
    g[CACHE_KEY] = db ? createSupabaseStorage(db) : createInMemoryStorage();
  }
  return g[CACHE_KEY];
}
