import type { Entity, EntityType, RelationType, SourceType } from "@/lib/memory/types";
import type { IntentKind } from "@/lib/retrieval";

/** A numbered piece of evidence, shown under the answer and openable. */
export interface Citation {
  index: number;
  eventId: string;
  integrationId: string;
  integrationName: string;
  sourceType: SourceType;
  title: string;
  excerpt: string;
  author?: string;
  occurredAt: string;
  url?: string;
}

/** The answer is assembled from blocks so the UI can render citations inline. */
export interface AnswerBlock {
  kind: "paragraph" | "bullet";
  text: string;
  citations: number[];
}

/** A memory the answer leaned on, in the shape the UI needs. */
export interface UsedMemory {
  id: string;
  type: EntityType;
  title: string;
  summary: string;
  confidence: number;
  occurredAt: string;
  reasons: string[];
  hop: 0 | 1;
}

export interface GraphEdgeView {
  type: RelationType;
  from: string;
  to: string;
  note?: string;
}

export interface ChatAnswer {
  question: string;
  intent: IntentKind;
  blocks: AnswerBlock[];
  citations: Citation[];
  memories: UsedMemory[];
  edges: GraphEdgeView[];
  /** Mean confidence of the memories the answer rests on. */
  confidence: number;
  /**
   * Whether memory actually carried this answer. False means the blocks say so
   * in plain words and hold nothing else — the UI renders that differently
   * because an admission is not an answer.
   */
  grounded: boolean;
  followUps: string[];
  answeredAt: string;
}

export interface ChatTurn {
  role: "user" | "agent";
  content: string;
}

export type EntityLike = Pick<Entity, "id" | "type" | "title" | "summary" | "confidence">;
