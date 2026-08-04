import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeEntities, mergeRelationships, withoutIntegration } from "@/lib/memory/merge";
import { normalize } from "@/lib/memory/keys";
import type { Entity, RawEvent, Relationship } from "@/lib/memory/types";
import { getUserId } from "@/lib/user";
import type {
  EntityFilter,
  MemoryStats,
  MemoryStore,
  RawEventFilter,
  RawEventStore,
  StorageProvider,
  UpsertResult,
} from "../types";

/**
 * Supabase-backed storage. Conforms to the same interfaces as the in-memory
 * provider, so nothing above the storage layer changes.
 *
 * `clear(integrationId)` still needs a per-record "drop sources from one
 * integration, delete if nothing is left" pass, replicated here in JS to
 * match `lib/memory/merge.ts#withoutIntegration`. Rewriting it as a single
 * Postgres set operation (a stored procedure) is deliberately deferred.
 */

function rawEventRow(userId: string, event: RawEvent) {
  return {
    user_id: userId,
    id: event.id,
    integration_id: event.integrationId,
    source_type: event.sourceType,
    external_id: event.externalId,
    title: event.title,
    body: event.body,
    author: event.author ?? null,
    participants: event.participants ?? null,
    url: event.url ?? null,
    occurred_at: event.occurredAt,
    ingested_at: event.ingestedAt,
    metadata: event.metadata,
  };
}

function rawEventFromRow(row: Record<string, unknown>): RawEvent {
  return {
    id: row.id as string,
    integrationId: row.integration_id as string,
    sourceType: row.source_type as RawEvent["sourceType"],
    externalId: row.external_id as string,
    title: row.title as string,
    body: row.body as string,
    author: (row.author as string | null) ?? undefined,
    participants: (row.participants as string[] | null) ?? undefined,
    url: (row.url as string | null) ?? undefined,
    occurredAt: row.occurred_at as string,
    ingestedAt: row.ingested_at as string,
    metadata: (row.metadata as RawEvent["metadata"]) ?? {},
  };
}

class SupabaseRawEventStore implements RawEventStore {
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async put(event: RawEvent) {
    const existing = await this.get(event.id);
    if (existing) return { event: existing, created: false };

    const { data, error } = await this.db
      .from("raw_events")
      .insert(rawEventRow(this.userId, event))
      .select()
      .single();

    if (error) {
      // Unique violation: another writer beat us to it (integration_id, external_id).
      if (error.code === "23505") {
        const again = await this.get(event.id);
        if (again) return { event: again, created: false };
      }
      throw new Error(`raw_events insert failed: ${error.message}`);
    }

    return { event: rawEventFromRow(data), created: true };
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from("raw_events")
      .select()
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`raw_events select failed: ${error.message}`);
    return data ? rawEventFromRow(data) : null;
  }

  async list(filter: RawEventFilter = {}) {
    let query = this.db.from("raw_events").select().eq("user_id", this.userId);
    if (filter.ids) query = query.in("id", filter.ids);
    if (filter.integrationId) query = query.eq("integration_id", filter.integrationId);
    if (filter.sourceType) query = query.eq("source_type", filter.sourceType);
    if (filter.since) query = query.gte("occurred_at", filter.since);
    query = query.order("occurred_at", { ascending: false });
    if (filter.limit) query = query.limit(filter.limit);

    const { data, error } = await query;
    if (error) throw new Error(`raw_events list failed: ${error.message}`);
    return (data ?? []).map(rawEventFromRow);
  }

  async count(filter: RawEventFilter = {}) {
    let query = this.db
      .from("raw_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", this.userId);
    if (filter.ids) query = query.in("id", filter.ids);
    if (filter.integrationId) query = query.eq("integration_id", filter.integrationId);
    if (filter.sourceType) query = query.eq("source_type", filter.sourceType);
    if (filter.since) query = query.gte("occurred_at", filter.since);

    const { count, error } = await query;
    if (error) throw new Error(`raw_events count failed: ${error.message}`);
    return count ?? 0;
  }

  async clear(integrationId?: string) {
    let query = this.db.from("raw_events").delete().eq("user_id", this.userId);
    if (integrationId) query = query.eq("integration_id", integrationId);
    const { error } = await query;
    if (error) throw new Error(`raw_events clear failed: ${error.message}`);
  }
}

function entityRow(userId: string, entity: Entity) {
  return {
    user_id: userId,
    id: entity.id,
    type: entity.type,
    key: entity.key,
    title: entity.title,
    summary: entity.summary,
    attributes: entity.attributes,
    confidence: entity.confidence,
    occurred_at: entity.occurredAt,
    first_seen_at: entity.firstSeenAt,
    last_seen_at: entity.lastSeenAt,
    sources: entity.sources,
    tags: entity.tags,
  };
}

function entityFromRow(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    type: row.type as Entity["type"],
    key: row.key as string,
    title: row.title as string,
    summary: row.summary as string,
    attributes: (row.attributes as Entity["attributes"]) ?? {},
    confidence: row.confidence as number,
    occurredAt: row.occurred_at as string,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    sources: (row.sources as Entity["sources"]) ?? [],
    tags: (row.tags as string[]) ?? [],
  };
}

function relationshipRow(userId: string, rel: Relationship) {
  return {
    user_id: userId,
    id: rel.id,
    type: rel.type,
    from_id: rel.fromId,
    to_id: rel.toId,
    confidence: rel.confidence,
    note: rel.note ?? null,
    sources: rel.sources,
    created_at: rel.createdAt,
  };
}

function relationshipFromRow(row: Record<string, unknown>): Relationship {
  return {
    id: row.id as string,
    type: row.type as Relationship["type"],
    fromId: row.from_id as string,
    toId: row.to_id as string,
    confidence: row.confidence as number,
    note: (row.note as string | null) ?? undefined,
    sources: (row.sources as Relationship["sources"]) ?? [],
    createdAt: row.created_at as string,
  };
}

class SupabaseMemoryStore implements MemoryStore {
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async upsertEntity(entity: Entity): Promise<UpsertResult> {
    const existing = await this.getEntityByKey(entity.key);

    if (!existing) {
      const { data, error } = await this.db
        .from("entities")
        .insert(entityRow(this.userId, entity))
        .select()
        .single();
      if (error) throw new Error(`entities insert failed: ${error.message}`);
      return { entity: entityFromRow(data), created: true };
    }

    const merged = mergeEntities(existing, entity);
    const { data, error } = await this.db
      .from("entities")
      .update(entityRow(this.userId, merged))
      .eq("user_id", this.userId)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(`entities update failed: ${error.message}`);
    return { entity: entityFromRow(data), created: false };
  }

  async getEntity(id: string) {
    const { data, error } = await this.db
      .from("entities")
      .select()
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`entities select failed: ${error.message}`);
    return data ? entityFromRow(data) : null;
  }

  async getEntityByKey(key: string) {
    const { data, error } = await this.db
      .from("entities")
      .select()
      .eq("user_id", this.userId)
      .eq("key", key)
      .maybeSingle();
    if (error) throw new Error(`entities select failed: ${error.message}`);
    return data ? entityFromRow(data) : null;
  }

  async listEntities(filter: EntityFilter = {}) {
    let query = this.db.from("entities").select().eq("user_id", this.userId);
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      query = query.in("type", types);
    }
    if (filter.minConfidence !== undefined) query = query.gte("confidence", filter.minConfidence);
    if (filter.since) query = query.gte("last_seen_at", filter.since);
    query = query.order("occurred_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`entities list failed: ${error.message}`);
    let out = (data ?? []).map(entityFromRow);

    // Filtered in JS: sources is a jsonb array and free-text search needs
    // normalization, neither of which is worth a SQL round-trip at this scale.
    if (filter.integrationId) {
      out = out.filter((e) => e.sources.some((s) => s.integrationId === filter.integrationId));
    }
    if (filter.query) {
      const q = normalize(filter.query);
      out = out.filter(
        (e) => normalize(e.title).includes(q) || normalize(e.summary).includes(q),
      );
    }
    return filter.limit ? out.slice(0, filter.limit) : out;
  }

  async upsertRelationship(relationship: Relationship) {
    const { data: existingRow, error: selectError } = await this.db
      .from("relationships")
      .select()
      .eq("user_id", this.userId)
      .eq("id", relationship.id)
      .maybeSingle();
    if (selectError) throw new Error(`relationships select failed: ${selectError.message}`);

    const existing = existingRow ? relationshipFromRow(existingRow) : null;
    const next = existing ? mergeRelationships(existing, relationship) : relationship;

    const { data, error } = await this.db
      .from("relationships")
      .upsert(relationshipRow(this.userId, next), { onConflict: "user_id,id" })
      .select()
      .single();
    if (error) throw new Error(`relationships upsert failed: ${error.message}`);
    return relationshipFromRow(data);
  }

  async listRelationships(entityId?: string) {
    let query = this.db.from("relationships").select().eq("user_id", this.userId);
    if (entityId) query = query.or(`from_id.eq.${entityId},to_id.eq.${entityId}`);

    const { data, error } = await query;
    if (error) throw new Error(`relationships list failed: ${error.message}`);
    return (data ?? []).map(relationshipFromRow);
  }

  async neighbors(entityIds: string[]) {
    if (entityIds.length === 0) return { entities: [], edges: [] };

    const orFilter = entityIds
      .map((id) => `from_id.eq.${id},to_id.eq.${id}`)
      .join(",");
    const { data: edgeRows, error: edgeError } = await this.db
      .from("relationships")
      .select()
      .eq("user_id", this.userId)
      .or(orFilter);
    if (edgeError) throw new Error(`relationships list failed: ${edgeError.message}`);
    const edges = (edgeRows ?? []).map(relationshipFromRow);

    const seed = new Set(entityIds);
    const ids = new Set<string>();
    for (const e of edges) {
      if (!seed.has(e.fromId)) ids.add(e.fromId);
      if (!seed.has(e.toId)) ids.add(e.toId);
    }
    if (ids.size === 0) return { entities: [], edges };

    const { data: entityRows, error: entityError } = await this.db
      .from("entities")
      .select()
      .eq("user_id", this.userId)
      .in("id", [...ids]);
    if (entityError) throw new Error(`entities list failed: ${entityError.message}`);

    return { entities: (entityRows ?? []).map(entityFromRow), edges };
  }

  async stats(): Promise<MemoryStats> {
    const [{ data: typeRows, error: typeError }, { count: relCount, error: relError }] =
      await Promise.all([
        this.db.from("entities").select("type").eq("user_id", this.userId),
        this.db
          .from("relationships")
          .select("id", { count: "exact", head: true })
          .eq("user_id", this.userId),
      ]);
    if (typeError) throw new Error(`entities stats failed: ${typeError.message}`);
    if (relError) throw new Error(`relationships stats failed: ${relError.message}`);

    const entitiesByType: Record<string, number> = {};
    for (const row of typeRows ?? []) {
      const type = row.type as string;
      entitiesByType[type] = (entitiesByType[type] ?? 0) + 1;
    }

    const { data: lastSeenRow, error: lastSeenError } = await this.db
      .from("entities")
      .select("last_seen_at")
      .eq("user_id", this.userId)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSeenError) throw new Error(`entities stats failed: ${lastSeenError.message}`);

    return {
      entities: typeRows?.length ?? 0,
      entitiesByType,
      relationships: relCount ?? 0,
      events: 0,
      eventsByIntegration: {},
      lastIngestedAt: (lastSeenRow?.last_seen_at as string | null) ?? null,
    };
  }

  /**
   * Disconnecting a tool must also unlearn what only that tool taught, or the
   * agent keeps citing evidence the user can no longer open. Fetch-mutate-write
   * for now; see the module doc comment about moving this into SQL.
   */
  async clear(integrationId?: string) {
    if (!integrationId) {
      const [{ error: relError }, { error: entError }] = await Promise.all([
        this.db.from("relationships").delete().eq("user_id", this.userId),
        this.db.from("entities").delete().eq("user_id", this.userId),
      ]);
      if (relError) throw new Error(`relationships clear failed: ${relError.message}`);
      if (entError) throw new Error(`entities clear failed: ${entError.message}`);
      return;
    }

    const [entities, relationships] = await Promise.all([
      this.listEntities(),
      this.listRelationships(),
    ]);

    const survivingIds = new Set<string>();
    const entityUpdates: Record<string, unknown>[] = [];
    const entityDeletes: string[] = [];
    for (const entity of entities) {
      const next = withoutIntegration(entity, integrationId);
      if (next) {
        survivingIds.add(next.id);
        entityUpdates.push(entityRow(this.userId, next));
      } else {
        entityDeletes.push(entity.id);
      }
    }

    const relUpdates: Record<string, unknown>[] = [];
    const relDeletes: string[] = [];
    for (const rel of relationships) {
      const next = withoutIntegration(rel, integrationId);
      const dangling = !survivingIds.has(rel.fromId) || !survivingIds.has(rel.toId);
      if (next && !dangling) relUpdates.push(relationshipRow(this.userId, next));
      else relDeletes.push(rel.id);
    }

    if (relDeletes.length) {
      const { error } = await this.db
        .from("relationships")
        .delete()
        .eq("user_id", this.userId)
        .in("id", relDeletes);
      if (error) throw new Error(`relationships clear failed: ${error.message}`);
    }
    if (relUpdates.length) {
      const { error } = await this.db
        .from("relationships")
        .upsert(relUpdates, { onConflict: "user_id,id" });
      if (error) throw new Error(`relationships clear failed: ${error.message}`);
    }
    if (entityDeletes.length) {
      const { error } = await this.db
        .from("entities")
        .delete()
        .eq("user_id", this.userId)
        .in("id", entityDeletes);
      if (error) throw new Error(`entities clear failed: ${error.message}`);
    }
    if (entityUpdates.length) {
      const { error } = await this.db
        .from("entities")
        .upsert(entityUpdates, { onConflict: "user_id,id" });
      if (error) throw new Error(`entities clear failed: ${error.message}`);
    }
  }
}

export function createSupabaseStorage(db: SupabaseClient): StorageProvider {
  const userId = getUserId();
  return {
    raw: new SupabaseRawEventStore(db, userId),
    memory: new SupabaseMemoryStore(db, userId),
  };
}
