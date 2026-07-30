import { getExtractor, MentionResolver } from "@/lib/extraction";
import { getConnector } from "@/lib/integrations/registry";
import { fetchFromSource } from "@/lib/integrations/source";
import { getIntegrationState, setIntegrationState } from "@/lib/integrations/state";
import { entityId, entityKey, eventId, relationshipId } from "@/lib/memory/keys";
import type {
  Entity,
  ExtractedEndpoint,
  ExtractedEntity,
  RawEvent,
  Relationship,
  SourceRef,
} from "@/lib/memory/types";
import { getStorage } from "@/lib/storage";

/**
 * The ingestion pipeline: connector → raw storage → extraction → memory.
 *
 * The order matters. Raw events are written before anything is inferred from
 * them, so every structured memory can be traced back to text that was stored
 * first and is never rewritten. Extraction failures degrade to "we kept the
 * source" rather than losing the data.
 */

export interface SyncReport {
  integrationId: string;
  eventsFetched: number;
  eventsStored: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  relationships: number;
  startedAt: string;
  finishedAt: string;
}

/** Load everything the memory already knows so mentions resolve across sources. */
async function hydrateResolver(): Promise<MentionResolver> {
  const resolver = new MentionResolver();
  const entities = await getStorage().memory.listEntities();
  for (const entity of entities) resolver.addEntity(entity);
  return resolver;
}

function toSourceRef(event: RawEvent, excerpt: string): SourceRef {
  return {
    eventId: event.id,
    integrationId: event.integrationId,
    sourceType: event.sourceType,
    excerpt,
    occurredAt: event.occurredAt,
    url: event.url,
  };
}

function toEntity(extracted: ExtractedEntity, event: RawEvent, now: string): Entity {
  const identity = extracted.keyHint ?? extracted.title;
  return {
    id: entityId(extracted.type, identity),
    type: extracted.type,
    key: entityKey(extracted.type, identity),
    title: extracted.title,
    summary: extracted.summary,
    attributes: extracted.attributes ?? {},
    confidence: extracted.confidence,
    occurredAt: extracted.occurredAt ?? event.occurredAt,
    firstSeenAt: now,
    lastSeenAt: now,
    sources: [toSourceRef(event, extracted.excerpt)],
    tags: extracted.tags ?? [],
  };
}

async function resolveEndpoint(endpoint: ExtractedEndpoint): Promise<Entity | null> {
  const key = endpoint.key ?? entityKey(endpoint.type, endpoint.title);
  return getStorage().memory.getEntityByKey(key);
}

/**
 * Pull everything a connector has since the last sync and fold it into memory.
 *
 * Idempotent: an event already in raw storage is not re-extracted, so syncing
 * twice does not inflate confidence with the same evidence counted again.
 */
export async function syncIntegration(
  integrationId: string,
  options: { full?: boolean } = {},
): Promise<SyncReport> {
  const connector = getConnector(integrationId);
  if (!connector) throw new Error(`Unknown integration: ${integrationId}`);

  const storage = getStorage();
  const state = getIntegrationState(integrationId);
  const startedAt = new Date().toISOString();
  const extractor = getExtractor();
  const resolver = await hydrateResolver();

  setIntegrationState(integrationId, { status: "syncing" });

  const fetched = await fetchFromSource(connector, {
    since: options.full ? undefined : (state?.lastSyncAt ?? undefined),
  });

  const report: SyncReport = {
    integrationId,
    eventsFetched: fetched.length,
    eventsStored: 0,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    relationships: 0,
    startedAt,
    finishedAt: startedAt,
  };

  // Oldest first: memory should learn in the order the company did.
  const ordered = [...fetched].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  for (const incoming of ordered) {
    const now = new Date().toISOString();
    const event: RawEvent = {
      ...incoming,
      id: eventId(integrationId, incoming.externalId),
      integrationId,
      ingestedAt: now,
    };

    const { created } = await storage.raw.put(event);
    if (!created) continue;
    report.eventsStored += 1;

    const result = await extractor.extract(event, { resolver, now });

    for (const extracted of result.entities) {
      const { entity, created: isNew } = await storage.memory.upsertEntity(
        toEntity(extracted, event, now),
      );
      if (isNew) report.entitiesCreated += 1;
      else report.entitiesUpdated += 1;
      resolver.addEntity(entity);
    }

    for (const edge of result.relationships) {
      const from = await resolveEndpoint(edge.from);
      const to = await resolveEndpoint(edge.to);
      // An edge to something that did not survive extraction is dropped rather
      // than stored dangling; the evidence for it is still in raw storage.
      if (!from || !to || from.id === to.id) continue;

      const relationship: Relationship = {
        id: relationshipId(edge.type, from.id, to.id),
        type: edge.type,
        fromId: from.id,
        toId: to.id,
        confidence: edge.confidence,
        note: edge.note,
        sources: [toSourceRef(event, edge.excerpt)],
        createdAt: now,
      };
      await storage.memory.upsertRelationship(relationship);
      report.relationships += 1;
    }
  }

  const eventsForIntegration = await storage.raw.count({ integrationId });
  const memories = (await storage.memory.listEntities({ integrationId })).length;

  report.finishedAt = new Date().toISOString();
  setIntegrationState(integrationId, {
    status: "connected",
    lastSyncAt: report.finishedAt,
    events: eventsForIntegration,
    memories,
  });

  return report;
}

/** Connect a source: mark it connected, then learn everything it has. */
export async function connectIntegration(integrationId: string): Promise<SyncReport> {
  setIntegrationState(integrationId, {
    status: "syncing",
    connectedAt: new Date().toISOString(),
  });
  return syncIntegration(integrationId, { full: true });
}

/** Disconnect: forget what only this source taught, keep everything corroborated. */
export async function disconnectIntegration(integrationId: string): Promise<void> {
  const storage = getStorage();
  await storage.memory.clear(integrationId);
  await storage.raw.clear(integrationId);
  setIntegrationState(integrationId, {
    status: "disconnected",
    connectedAt: null,
    lastSyncAt: null,
    events: 0,
    memories: 0,
  });
}
