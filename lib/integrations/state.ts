import { defaultConnectedIds, getConnector, listConnectors } from "./registry";
import type { IntegrationState, IntegrationSummary } from "./types";

/**
 * Connection state lives apart from the connectors themselves so a connector
 * stays a pure fetcher. In production this table is a row per workspace and per
 * integration; here it is a map with the same shape.
 */
const CACHE_KEY = Symbol.for("relay.integrations");

type Global = typeof globalThis & { [CACHE_KEY]?: Map<string, IntegrationState> };

function table(): Map<string, IntegrationState> {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) {
    const map = new Map<string, IntegrationState>();
    const connected = new Set(defaultConnectedIds());
    for (const c of listConnectors()) {
      map.set(c.id, {
        id: c.id,
        status: connected.has(c.id) ? "connected" : "disconnected",
        connectedAt: connected.has(c.id) ? new Date().toISOString() : null,
        lastSyncAt: null,
        events: 0,
        memories: 0,
      });
    }
    g[CACHE_KEY] = map;
  }
  return g[CACHE_KEY];
}

export function getIntegrationState(id: string): IntegrationState | null {
  return table().get(id) ?? null;
}

export function setIntegrationState(id: string, patch: Partial<IntegrationState>): IntegrationState {
  const current = table().get(id);
  if (!current) throw new Error(`Unknown integration: ${id}`);
  const next = { ...current, ...patch };
  table().set(id, next);
  return next;
}

export function isConnected(id: string): boolean {
  return table().get(id)?.status === "connected";
}

export function connectedIntegrationIds(): string[] {
  return [...table().values()].filter((s) => s.status !== "disconnected").map((s) => s.id);
}

/** Connector definition joined with its runtime state, for the integrations page. */
export function listIntegrationSummaries(): IntegrationSummary[] {
  return listConnectors().map((c) => {
    const state = table().get(c.id)!;
    return {
      ...state,
      name: c.name,
      blurb: c.blurb,
      category: c.category,
      teaches: c.teaches,
    };
  });
}

export function integrationSummary(id: string): IntegrationSummary | null {
  const connector = getConnector(id);
  const state = getIntegrationState(id);
  if (!connector || !state) return null;
  return {
    ...state,
    name: connector.name,
    blurb: connector.blurb,
    category: connector.category,
    teaches: connector.teaches,
  };
}
