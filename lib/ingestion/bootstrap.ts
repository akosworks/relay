import { connectedIntegrationIds, getIntegrationState } from "@/lib/integrations/state";
import { syncIntegration } from "./pipeline";

/**
 * First-run learning.
 *
 * A memory that starts empty cannot demonstrate anything, so the sources that
 * are connected by default are synced once, lazily, on the first request that
 * needs memory. Guarded by a promise so concurrent requests do not each start
 * their own sync.
 */
const CACHE_KEY = Symbol.for("relay.bootstrap");

type Global = typeof globalThis & { [CACHE_KEY]?: Promise<void> };

async function run(): Promise<void> {
  for (const id of connectedIntegrationIds()) {
    const state = getIntegrationState(id);
    if (state?.lastSyncAt) continue;
    await syncIntegration(id, { full: true });
  }
}

export function ensureBootstrapped(): Promise<void> {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = run();
  return g[CACHE_KEY];
}
