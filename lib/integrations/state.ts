import { getSupabase } from "@/lib/supabase/client";
import { getUserId } from "@/lib/user";
import { getConnector, listConnectors } from "./registry";
import type { IntegrationState, IntegrationSummary } from "./types";

/**
 * Connection state lives apart from the connectors themselves so a connector
 * stays a pure fetcher. In production this table is a row per workspace and
 * per integration; here it is a row per user and per integration once
 * Supabase is configured, or an in-process map otherwise.
 *
 * Nothing is connected out of the box. An empty memory is the honest starting
 * point for a product whose promise is that it only knows what it was told.
 */

const CACHE_KEY = Symbol.for("relay.integrations");
type Global = typeof globalThis & { [CACHE_KEY]?: Map<string, IntegrationState> };

function defaultState(id: string): IntegrationState {
  return { id, status: "disconnected", connectedAt: null, lastSyncAt: null, events: 0, memories: 0 };
}

function memoryTable(): Map<string, IntegrationState> {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) {
    const map = new Map<string, IntegrationState>();
    for (const c of listConnectors()) map.set(c.id, defaultState(c.id));
    g[CACHE_KEY] = map;
  }
  return g[CACHE_KEY];
}

function rowToState(row: Record<string, unknown>): IntegrationState {
  return {
    id: row.integration_id as string,
    status: row.status as IntegrationState["status"],
    connectedAt: (row.connected_at as string | null) ?? null,
    lastSyncAt: (row.last_sync_at as string | null) ?? null,
    events: row.events as number,
    memories: row.memories as number,
  };
}

function stateToRow(userId: string, state: IntegrationState) {
  return {
    user_id: userId,
    integration_id: state.id,
    status: state.status,
    connected_at: state.connectedAt,
    last_sync_at: state.lastSyncAt,
    events: state.events,
    memories: state.memories,
  };
}

const SEED_KEY = Symbol.for("relay.integrations.seeded");
type SeedGlobal = typeof globalThis & { [SEED_KEY]?: Promise<void> };

/** Every known connector gets a disconnected row on first touch, exactly once per process. */
async function ensureSeeded(): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const g = globalThis as SeedGlobal;
  if (!g[SEED_KEY]) {
    const userId = getUserId();
    g[SEED_KEY] = (async () => {
      const { error } = await db
        .from("integration_state")
        .upsert(
          listConnectors().map((c) => stateToRow(userId, defaultState(c.id))),
          { onConflict: "user_id,integration_id", ignoreDuplicates: true },
        );
      if (error) throw new Error(`integration_state seed failed: ${error.message}`);
    })();
  }
  return g[SEED_KEY];
}

export async function getIntegrationState(id: string): Promise<IntegrationState | null> {
  const db = getSupabase();
  if (!db) return memoryTable().get(id) ?? null;

  await ensureSeeded();
  const { data, error } = await db
    .from("integration_state")
    .select()
    .eq("user_id", getUserId())
    .eq("integration_id", id)
    .maybeSingle();
  if (error) throw new Error(`integration_state select failed: ${error.message}`);
  return data ? rowToState(data) : null;
}

export async function setIntegrationState(
  id: string,
  patch: Partial<IntegrationState>,
): Promise<IntegrationState> {
  const db = getSupabase();
  if (!db) {
    const current = memoryTable().get(id);
    if (!current) throw new Error(`Unknown integration: ${id}`);
    const next = { ...current, ...patch };
    memoryTable().set(id, next);
    return next;
  }

  const current = await getIntegrationState(id);
  if (!current) throw new Error(`Unknown integration: ${id}`);
  const next = { ...current, ...patch };

  const { data, error } = await db
    .from("integration_state")
    .update(stateToRow(getUserId(), next))
    .eq("user_id", getUserId())
    .eq("integration_id", id)
    .select()
    .single();
  if (error) throw new Error(`integration_state update failed: ${error.message}`);
  return rowToState(data);
}

export async function isConnected(id: string): Promise<boolean> {
  const state = await getIntegrationState(id);
  return state?.status === "connected";
}

export async function connectedIntegrationIds(): Promise<string[]> {
  const summaries = await Promise.all(listConnectors().map((c) => getIntegrationState(c.id)));
  return summaries
    .filter((s): s is IntegrationState => Boolean(s) && s!.status !== "disconnected")
    .map((s) => s.id);
}

/** Connector definition joined with its runtime state, for the integrations page. */
export async function listIntegrationSummaries(): Promise<IntegrationSummary[]> {
  const connectors = listConnectors();
  const states = await Promise.all(connectors.map((c) => getIntegrationState(c.id)));
  return connectors.map((c, i) => {
    const state = states[i] ?? defaultState(c.id);
    return {
      ...state,
      name: c.name,
      blurb: c.blurb,
      category: c.category,
      teaches: c.teaches,
      live: c.isLive?.() ?? false,
    };
  });
}

export async function integrationSummary(id: string): Promise<IntegrationSummary | null> {
  const connector = getConnector(id);
  const state = await getIntegrationState(id);
  if (!connector || !state) return null;
  return {
    ...state,
    name: connector.name,
    blurb: connector.blurb,
    category: connector.category,
    teaches: connector.teaches,
    live: connector.isLive?.() ?? false,
  };
}
