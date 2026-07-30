/**
 * The memory model.
 *
 * Relay does not store documents; it stores what documents said. A raw event
 * is the thing that arrived (a Slack message, a transcript, a pull request).
 * An entity is the piece of organizational knowledge extracted from it. Every
 * entity keeps pointers back to the raw events it came from, so any claim the
 * agent makes can be traced to something a human actually wrote.
 */

/** Kinds of structured memory the extraction layer can produce. */
export const ENTITY_TYPES = [
  "decision",
  "project",
  "person",
  "meeting",
  "task",
  "customer",
  "procedure",
  "issue",
  "feature",
  "document",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Relationships are first-class: the graph, not the entity list, is what makes
 * an answer like "why was the launch delayed" possible.
 */
export const RELATION_TYPES = [
  "decided_by",
  "participated_in",
  "owns",
  "assigned_to",
  "depends_on",
  "blocks",
  "affects",
  "mentions",
  "references",
  "created_from",
  "related_to",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

/** Where a piece of knowledge physically came from. */
export type SourceType =
  | "slack.message"
  | "slack.member"
  | "github.pull_request"
  | "github.issue"
  | "github.commit"
  | "github.repository"
  | "notion.page"
  | "gdocs.document"
  | "gdrive.file"
  | "gmail.thread";

/** A raw record exactly as the connector handed it over. Never mutated. */
export interface RawEvent {
  id: string;
  integrationId: string;
  sourceType: SourceType;
  /** Stable id in the origin system. Used to make ingestion idempotent. */
  externalId: string;
  title: string;
  body: string;
  author?: string;
  participants?: string[];
  url?: string;
  /** When the thing happened in the origin system. */
  occurredAt: string;
  /** When Relay first saw it. */
  ingestedAt: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
}

/** A citation: the exact fragment of a raw event that supports a memory. */
export interface SourceRef {
  eventId: string;
  integrationId: string;
  sourceType: SourceType;
  /** The quoted span. Short enough to show inline under an answer. */
  excerpt: string;
  occurredAt: string;
  url?: string;
}

export type AttributeValue = string | number | boolean | string[] | null;

/** A unit of structured organizational memory. */
export interface Entity {
  id: string;
  type: EntityType;
  /** Canonical dedupe key: `type:normalized-title`. Merging happens on this. */
  key: string;
  title: string;
  /** One-line statement of what this memory is. Written by the extractor. */
  summary: string;
  /** Type-specific facts (status, owner, dueDate, rationale, ...). */
  attributes: Record<string, AttributeValue>;
  /** 0-1. Rises as independent sources corroborate the same memory. */
  confidence: number;
  /** When the underlying fact happened, not when it was ingested. */
  occurredAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: SourceRef[];
  tags: string[];
}

export interface Relationship {
  id: string;
  type: RelationType;
  fromId: string;
  toId: string;
  confidence: number;
  /** Human-readable reason the edge exists, shown when traversing the graph. */
  note?: string;
  sources: SourceRef[];
  createdAt: string;
}

/** What an extractor returns before ids and merging are applied. */
export interface ExtractedEntity {
  type: EntityType;
  title: string;
  /**
   * Overrides the title-derived dedupe key. Used where the origin system
   * already has a stronger identity than prose does — a ticket id, say, so a
   * passing mention of "ATLAS-214" in Slack merges into the Jira ticket.
   */
  keyHint?: string;
  summary: string;
  attributes?: Record<string, AttributeValue>;
  confidence: number;
  occurredAt?: string;
  tags?: string[];
  /** The span of source text that justifies this memory. */
  excerpt: string;
}

/** One endpoint of an extracted edge, resolved to a stored entity after merging. */
export interface ExtractedEndpoint {
  type: EntityType;
  title: string;
  /** Canonical key when the extractor already knows it. Beats title matching. */
  key?: string;
}

/** An edge expressed in terms of entities, resolved after merging. */
export interface ExtractedRelationship {
  type: RelationType;
  from: ExtractedEndpoint;
  to: ExtractedEndpoint;
  confidence: number;
  note?: string;
  excerpt: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

/** A raw event in the shape the UI shows it. */
export interface EvidenceView {
  id: string;
  integrationId: string;
  integrationName: string;
  sourceType: SourceType;
  title: string;
  body: string;
  author?: string;
  occurredAt: string;
  url?: string;
}

/** One memory opened up: its graph, its history and the sources behind it. */
export interface EntityDetail {
  entity: Entity;
  timeline: TimelineItem[];
  related: {
    direction: "in" | "out";
    type: RelationType;
    note?: string;
    confidence: number;
    entity: Pick<Entity, "id" | "type" | "title" | "summary" | "confidence">;
  }[];
  evidence: EvidenceView[];
}

/** A point on an entity's history: when it was learned, and from what. */
export interface TimelineItem {
  at: string;
  kind: "learned" | "corroborated" | "linked";
  label: string;
  sourceType?: SourceType;
  integrationId?: string;
  eventId?: string;
  entityId?: string;
}
