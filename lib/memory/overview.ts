import { listIntegrationSummaries } from "@/lib/integrations/state";
import type { IntegrationSummary } from "@/lib/integrations/types";
import { getStorage } from "@/lib/storage";
import type { EntityType } from "./types";

/**
 * A read model for the UI: what memory currently holds and what it learned
 * most recently. Composed here rather than in a route so any surface — the
 * chat panel, the integrations page — reads the same numbers.
 */
export interface MemoryOverview {
  entities: number;
  relationships: number;
  events: number;
  entitiesByType: Record<string, number>;
  integrations: IntegrationSummary[];
  recent: {
    id: string;
    type: EntityType;
    title: string;
    summary: string;
    confidence: number;
    occurredAt: string;
    sources: number;
  }[];
}

export async function getMemoryOverview(): Promise<MemoryOverview> {
  const storage = getStorage();
  const [stats, entities, events] = await Promise.all([
    storage.memory.stats(),
    storage.memory.listEntities(),
    storage.raw.count(),
  ]);

  const recent = [...entities]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      summary: e.summary,
      confidence: e.confidence,
      occurredAt: e.occurredAt,
      sources: e.sources.length,
    }));

  return {
    entities: stats.entities,
    relationships: stats.relationships,
    events,
    entitiesByType: stats.entitiesByType,
    integrations: listIntegrationSummaries(),
    recent,
  };
}
