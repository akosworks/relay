import type {
  Entity,
  EntityType,
  RawEvent,
  Relationship,
  SourceType,
} from "@/lib/memory/types";

/**
 * Storage is behind an interface so the in-memory implementation used by this
 * MVP can be swapped for Postgres plus a vector index without any other module
 * knowing. Nothing above this layer may assume synchronous access.
 */

export interface RawEventFilter {
  integrationId?: string;
  sourceType?: SourceType;
  ids?: string[];
  since?: string;
  limit?: number;
}

export interface RawEventStore {
  put(event: RawEvent): Promise<{ event: RawEvent; created: boolean }>;
  get(id: string): Promise<RawEvent | null>;
  list(filter?: RawEventFilter): Promise<RawEvent[]>;
  count(filter?: RawEventFilter): Promise<number>;
  clear(integrationId?: string): Promise<void>;
}

export interface EntityFilter {
  type?: EntityType | EntityType[];
  integrationId?: string;
  minConfidence?: number;
  since?: string;
  query?: string;
  limit?: number;
}

export interface UpsertResult {
  entity: Entity;
  created: boolean;
}

export interface MemoryStats {
  entities: number;
  entitiesByType: Record<string, number>;
  relationships: number;
  events: number;
  eventsByIntegration: Record<string, number>;
  lastIngestedAt: string | null;
}

export interface MemoryStore {
  upsertEntity(entity: Entity): Promise<UpsertResult>;
  getEntity(id: string): Promise<Entity | null>;
  getEntityByKey(key: string): Promise<Entity | null>;
  listEntities(filter?: EntityFilter): Promise<Entity[]>;

  upsertRelationship(relationship: Relationship): Promise<Relationship>;
  listRelationships(entityId?: string): Promise<Relationship[]>;
  /** One hop out from a set of entities, in either direction. */
  neighbors(entityIds: string[]): Promise<{ entities: Entity[]; edges: Relationship[] }>;

  stats(): Promise<MemoryStats>;
  clear(integrationId?: string): Promise<void>;
}

export interface StorageProvider {
  raw: RawEventStore;
  memory: MemoryStore;
}
