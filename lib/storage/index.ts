import { createInMemoryStorage } from "./in-memory";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";

/**
 * One storage provider per process, cached on `globalThis` so the dev server's
 * hot reloads do not silently hand out a second, empty memory.
 *
 * Selecting a different provider (Postgres, a vector store, a graph database)
 * happens here and nowhere else.
 */
const CACHE_KEY = Symbol.for("relay.storage");

type Global = typeof globalThis & { [CACHE_KEY]?: StorageProvider };

export function getStorage(): StorageProvider {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = createInMemoryStorage();
  return g[CACHE_KEY];
}
