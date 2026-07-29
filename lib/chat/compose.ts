import { getConnector } from "@/lib/integrations/registry";
import type { Entity, RawEvent, Relationship, SourceRef } from "@/lib/memory/types";
import type { RetrievedMemory } from "@/lib/retrieval";
import type { AnswerBlock, Citation } from "./types";

/**
 * Answer assembly.
 *
 * The rule this file exists to enforce: a sentence may only be written if a
 * stored memory supports it, and the evidence behind that memory is numbered
 * and attached. Blocks that cannot be cited are dropped rather than softened,
 * which is why the agent says "I don't have that" instead of guessing.
 */
/** Anything that can back a claim: an entity or a relationship. */
export type Evidenced = { sources: SourceRef[] };

export class Composer {
  private blocks: AnswerBlock[] = [];
  private citations: Citation[] = [];
  private byEvent = new Map<string, number>();

  constructor(private readonly evidence: Map<string, RawEvent>) {}

  /**
   * Number the evidence behind a memory or an edge, reusing numbers already
   * assigned. Relationships carry their own evidence, so "Priya owns
   * authentication" cites the sentence that said so, not the person record.
   */
  cite(node: Evidenced | undefined, max = 2): number[] {
    if (!node) return [];
    const out: number[] = [];
    for (const source of node.sources.slice(0, max)) {
      const existing = this.byEvent.get(source.eventId);
      if (existing) {
        out.push(existing);
        continue;
      }
      const event = this.evidence.get(source.eventId);
      const index = this.citations.length + 1;
      const connector = getConnector(source.integrationId);
      this.citations.push({
        index,
        eventId: source.eventId,
        integrationId: source.integrationId,
        integrationName: connector?.name ?? source.integrationId,
        sourceType: source.sourceType,
        title: event?.title ?? source.sourceType,
        excerpt: source.excerpt,
        author: event?.author,
        occurredAt: source.occurredAt,
        url: source.url ?? event?.url,
      });
      this.byEvent.set(source.eventId, index);
      out.push(index);
    }
    return out;
  }

  say(text: string, node: Evidenced | undefined, kind: AnswerBlock["kind"] = "paragraph") {
    const citations = this.cite(node);
    if (citations.length === 0) return;
    this.blocks.push({ kind, text: text.replace(/\s+/g, " ").trim(), citations });
  }

  /** For statements that rest on more than one memory. */
  sayAcross(text: string, nodes: (Evidenced | undefined)[], kind: AnswerBlock["kind"] = "paragraph") {
    const citations = nodes.flatMap((n) => this.cite(n, 1));
    if (citations.length === 0) return;
    this.blocks.push({
      kind,
      text: text.replace(/\s+/g, " ").trim(),
      citations: [...new Set(citations)],
    });
  }

  get result() {
    return { blocks: this.blocks, citations: this.citations };
  }

  get isEmpty() {
    return this.blocks.length === 0;
  }
}

// ------------------------------------------------------------ graph helpers

export function edgesFrom(edges: Relationship[], id: string, type?: string) {
  return edges.filter((e) => e.fromId === id && (!type || e.type === type));
}

export function edgesTo(edges: Relationship[], id: string, type?: string) {
  return edges.filter((e) => e.toId === id && (!type || e.type === type));
}

export function other(edge: Relationship, id: string) {
  return edge.fromId === id ? edge.toId : edge.fromId;
}

export function lookup(memories: RetrievedMemory[], id: string): Entity | undefined {
  return memories.find((m) => m.entity.id === id)?.entity;
}

export function firstOfType(
  memories: RetrievedMemory[],
  type: Entity["type"],
): Entity | undefined {
  return memories.find((m) => m.entity.type === type)?.entity;
}

export function allOfType(memories: RetrievedMemory[], type: Entity["type"]): Entity[] {
  return memories.filter((m) => m.entity.type === type).map((m) => m.entity);
}

/** "13 August 2026" reads better in an answer than an ISO timestamp. */
export function humanDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function attr(entity: Entity | undefined, key: string): string | null {
  const value = entity?.attributes[key];
  if (value === null || value === undefined) return null;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function attrList(entity: Entity | undefined, key: string): string[] {
  const value = entity?.attributes[key];
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value ? [value] : [];
}
