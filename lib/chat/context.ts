import { getConnector } from "@/lib/integrations/registry";
import type { Entity, RawEvent, Relationship } from "@/lib/memory/types";
import type { RetrievalResult, RetrievedMemory } from "@/lib/retrieval";
import { humanDate } from "./compose";
import type { Citation, GraphEdgeView, UsedMemory } from "./types";

/**
 * What the model is allowed to see.
 *
 * The agent does not hand the model a question and hope. It hands it a numbered
 * transcript of what memory holds, and the numbers are citations — so "cite your
 * sources" is not a request the model can fudge, it is a reference to text
 * physically present in its context. Anything absent from this block is, as far
 * as the model is concerned, unknown.
 *
 * The accumulator is stateful across a turn because the agent may retrieve more
 * than once (a second search, a fresh sync). Citation [4] must mean the same
 * event in the final answer as it did three tool calls ago.
 */
export class Context {
  private readonly citations: Citation[] = [];
  private readonly byEvent = new Map<string, number>();
  private readonly memories = new Map<string, RetrievedMemory>();
  private readonly edges = new Map<string, Relationship>();
  private readonly evidence = new Map<string, RawEvent>();

  /** Fold a retrieval result in, returning the block to show the model. */
  absorb(result: RetrievalResult, label: string): string {
    for (const event of result.evidence) this.evidence.set(event.id, event);
    for (const memory of result.memories) {
      const existing = this.memories.get(memory.entity.id);
      if (!existing || memory.score > existing.score) {
        this.memories.set(memory.entity.id, memory);
      }
    }
    for (const edge of result.edges) this.edges.set(edge.id, edge);

    return this.render(result, label);
  }

  private index(eventId: string): number | null {
    const existing = this.byEvent.get(eventId);
    if (existing) return existing;

    const event = this.evidence.get(eventId);
    if (!event) return null;

    const connector = getConnector(event.integrationId);
    const index = this.citations.length + 1;
    this.citations.push({
      index,
      eventId: event.id,
      integrationId: event.integrationId,
      integrationName: connector?.name ?? event.integrationId,
      sourceType: event.sourceType,
      title: event.title,
      excerpt: event.body.slice(0, 320),
      author: event.author,
      occurredAt: event.occurredAt,
      url: event.url,
    });
    this.byEvent.set(event.id, index);
    return index;
  }

  /** Citation numbers for everything backing one memory. */
  private marks(entity: Entity): number[] {
    const out: number[] = [];
    for (const source of entity.sources.slice(0, 3)) {
      const index = this.index(source.eventId);
      if (index && !out.includes(index)) out.push(index);
    }
    return out;
  }

  private describe(memory: RetrievedMemory): string {
    const e = memory.entity;
    const marks = this.marks(e);
    const head = `- ${e.type} · ${e.title}${marks.length ? ` ${marks.map((m) => `[${m}]`).join("")}` : ""}`;

    const facts: string[] = [];
    if (e.summary && e.summary !== e.title) facts.push(e.summary);
    for (const [key, value] of Object.entries(e.attributes)) {
      if (value === null || value === undefined || value === "") continue;
      facts.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
    facts.push(`dated ${humanDate(e.occurredAt)}`);
    facts.push(`confidence ${e.confidence.toFixed(2)}`);
    if (memory.hop === 1) facts.push("reached through the graph, not named directly");

    return `${head}\n    ${facts.join(" · ")}`;
  }

  private describeEdge(edge: Relationship): string | null {
    const from = this.memories.get(edge.fromId)?.entity;
    const to = this.memories.get(edge.toId)?.entity;
    if (!from || !to) return null;
    const marks = edge.sources
      .slice(0, 2)
      .map((s) => this.index(s.eventId))
      .filter((m): m is number => m !== null);
    return `- ${from.title} —${edge.type.replace(/_/g, " ")}→ ${to.title}${
      edge.note ? ` (${edge.note})` : ""
    }${marks.length ? ` ${marks.map((m) => `[${m}]`).join("")}` : ""}`;
  }

  private render(result: RetrievalResult, label: string): string {
    if (result.memories.length === 0) {
      return `${label}\n(nothing — memory holds no entry that this question reaches)`;
    }

    const lines = [label, "", "MEMORIES:"];
    for (const memory of result.memories) lines.push(this.describe(memory));

    const edgeLines = result.edges
      .map((edge) => this.describeEdge(edge))
      .filter((line): line is string => line !== null);
    if (edgeLines.length) {
      lines.push("", "HOW THEY RELATE:");
      lines.push(...edgeLines);
    }

    const sourceLines = this.citations.map(
      (c) =>
        `[${c.index}] ${c.integrationName} · ${c.title}${
          c.author ? ` · ${c.author}` : ""
        } · ${humanDate(c.occurredAt)}\n    "${c.excerpt.replace(/\s+/g, " ").trim()}"`,
    );
    if (sourceLines.length) {
      lines.push("", "SOURCES (cite these numbers):");
      lines.push(...sourceLines);
    }

    return lines.join("\n");
  }

  get isEmpty(): boolean {
    return this.memories.size === 0;
  }

  /** Everything the answer is allowed to rest on, in the shape the UI wants. */
  get result(): {
    citations: Citation[];
    memories: UsedMemory[];
    edges: GraphEdgeView[];
    confidence: number;
  } {
    const memories = [...this.memories.values()]
      .sort((a, b) => b.score - a.score)
      .map(
        (m): UsedMemory => ({
          id: m.entity.id,
          type: m.entity.type,
          title: m.entity.title,
          summary: m.entity.summary,
          confidence: m.entity.confidence,
          occurredAt: m.entity.occurredAt,
          reasons: m.reasons,
          hop: m.hop,
        }),
      );

    const edges: GraphEdgeView[] = [];
    for (const edge of this.edges.values()) {
      const from = this.memories.get(edge.fromId)?.entity;
      const to = this.memories.get(edge.toId)?.entity;
      if (!from || !to) continue;
      edges.push({ type: edge.type, from: from.title, to: to.title, note: edge.note });
    }

    const confidence = memories.length
      ? memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length
      : 0;

    return { citations: this.citations, memories, edges, confidence };
  }
}
