import { mergeEntities, mergeRelationships, withoutIntegration } from "@/lib/memory/merge";
import { normalize } from "@/lib/memory/keys";
import type { Entity, RawEvent, Relationship } from "@/lib/memory/types";
import type {
  EntityFilter,
  MemoryStats,
  MemoryStore,
  RawEventFilter,
  RawEventStore,
  StorageProvider,
  UpsertResult,
} from "./types";

/**
 * The reference storage provider: plain maps, no dependencies, no I/O.
 *
 * It exists so the pipeline can be exercised end to end. Swapping it for
 * Postgres plus pgvector means implementing the same two interfaces; nothing
 * upstream of `getStorage()` changes.
 */

class InMemoryRawStore implements RawEventStore {
  private events = new Map<string, RawEvent>();

  async put(event: RawEvent) {
    const existing = this.events.get(event.id);
    if (existing) return { event: existing, created: false };
    this.events.set(event.id, event);
    return { event, created: true };
  }

  async get(id: string) {
    return this.events.get(id) ?? null;
  }

  async list(filter: RawEventFilter = {}) {
    let out = [...this.events.values()];
    if (filter.ids) {
      const set = new Set(filter.ids);
      out = out.filter((e) => set.has(e.id));
    }
    if (filter.integrationId) out = out.filter((e) => e.integrationId === filter.integrationId);
    if (filter.sourceType) out = out.filter((e) => e.sourceType === filter.sourceType);
    if (filter.since) out = out.filter((e) => e.occurredAt >= filter.since!);
    out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return filter.limit ? out.slice(0, filter.limit) : out;
  }

  async count(filter: RawEventFilter = {}) {
    return (await this.list(filter)).length;
  }

  async clear(integrationId?: string) {
    if (!integrationId) {
      this.events.clear();
      return;
    }
    for (const [id, e] of this.events) {
      if (e.integrationId === integrationId) this.events.delete(id);
    }
  }
}

class InMemoryMemoryStore implements MemoryStore {
  private entities = new Map<string, Entity>();
  private byKey = new Map<string, string>();
  private relationships = new Map<string, Relationship>();

  async upsertEntity(entity: Entity): Promise<UpsertResult> {
    const existingId = this.byKey.get(entity.key);
    const existing = existingId ? this.entities.get(existingId) : undefined;

    if (!existing) {
      this.entities.set(entity.id, entity);
      this.byKey.set(entity.key, entity.id);
      return { entity, created: true };
    }

    const merged = mergeEntities(existing, entity);
    this.entities.set(merged.id, merged);
    return { entity: merged, created: false };
  }

  async getEntity(id: string) {
    return this.entities.get(id) ?? null;
  }

  async getEntityByKey(key: string) {
    const id = this.byKey.get(key);
    return id ? (this.entities.get(id) ?? null) : null;
  }

  async listEntities(filter: EntityFilter = {}) {
    let out = [...this.entities.values()];
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      out = out.filter((e) => types.includes(e.type));
    }
    if (filter.integrationId) {
      out = out.filter((e) => e.sources.some((s) => s.integrationId === filter.integrationId));
    }
    if (filter.minConfidence !== undefined) {
      out = out.filter((e) => e.confidence >= filter.minConfidence!);
    }
    if (filter.since) out = out.filter((e) => e.lastSeenAt >= filter.since!);
    if (filter.query) {
      const q = normalize(filter.query);
      out = out.filter(
        (e) => normalize(e.title).includes(q) || normalize(e.summary).includes(q),
      );
    }
    out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return filter.limit ? out.slice(0, filter.limit) : out;
  }

  async upsertRelationship(relationship: Relationship) {
    const existing = this.relationships.get(relationship.id);
    const next = existing ? mergeRelationships(existing, relationship) : relationship;
    this.relationships.set(next.id, next);
    return next;
  }

  async listRelationships(entityId?: string) {
    const all = [...this.relationships.values()];
    if (!entityId) return all;
    return all.filter((r) => r.fromId === entityId || r.toId === entityId);
  }

  async neighbors(entityIds: string[]) {
    const seed = new Set(entityIds);
    const edges = [...this.relationships.values()].filter(
      (r) => seed.has(r.fromId) || seed.has(r.toId),
    );
    const ids = new Set<string>();
    for (const e of edges) {
      if (!seed.has(e.fromId)) ids.add(e.fromId);
      if (!seed.has(e.toId)) ids.add(e.toId);
    }
    const entities = [...ids]
      .map((id) => this.entities.get(id))
      .filter((e): e is Entity => Boolean(e));
    return { entities, edges };
  }

  async stats(): Promise<MemoryStats> {
    const entitiesByType: Record<string, number> = {};
    let lastIngestedAt: string | null = null;
    for (const e of this.entities.values()) {
      entitiesByType[e.type] = (entitiesByType[e.type] ?? 0) + 1;
      if (!lastIngestedAt || e.lastSeenAt > lastIngestedAt) lastIngestedAt = e.lastSeenAt;
    }
    return {
      entities: this.entities.size,
      entitiesByType,
      relationships: this.relationships.size,
      events: 0,
      eventsByIntegration: {},
      lastIngestedAt,
    };
  }

  /**
   * Disconnecting a tool must also unlearn what only that tool taught, or the
   * agent keeps citing evidence the user can no longer open.
   */
  async clear(integrationId?: string) {
    if (!integrationId) {
      this.entities.clear();
      this.byKey.clear();
      this.relationships.clear();
      return;
    }

    for (const [id, entity] of this.entities) {
      const next = withoutIntegration(entity, integrationId);
      if (next) this.entities.set(id, next);
      else {
        this.entities.delete(id);
        this.byKey.delete(entity.key);
      }
    }
    for (const [id, rel] of this.relationships) {
      const next = withoutIntegration(rel, integrationId);
      const dangling = !this.entities.has(rel.fromId) || !this.entities.has(rel.toId);
      if (next && !dangling) this.relationships.set(id, next);
      else this.relationships.delete(id);
    }
  }
}

export function createInMemoryStorage(): StorageProvider {
  return { raw: new InMemoryRawStore(), memory: new InMemoryMemoryStore() };
}
