import { MentionResolver } from "@/lib/extraction";
import { contentWords } from "@/lib/extraction/text";
import type { Entity, RawEvent, Relationship } from "@/lib/memory/types";
import { getStorage } from "@/lib/storage";
import { analyzeIntent, type Intent } from "./intent";

export type { Intent, IntentKind } from "./intent";

/**
 * Retrieval.
 *
 * Three signals, combined: lexical match against the structured memory (not
 * the raw text), the graph around whatever the question names, and how
 * confident and recent the memory is. Swapping the first signal for embeddings
 * means replacing `lexicalScore`; the graph and evidence steps are unaffected.
 */

export interface RetrievedMemory {
  entity: Entity;
  score: number;
  /** Why this memory was retrieved. Surfaced in the UI, not just for debugging. */
  reasons: string[];
  /** Distance from the question: 0 direct hit, 1 reached through the graph. */
  hop: 0 | 1;
}

export interface RetrievalResult {
  intent: Intent;
  memories: RetrievedMemory[];
  edges: Relationship[];
  evidence: RawEvent[];
}

export interface RetrieveOptions {
  limit?: number;
  evidenceLimit?: number;
}

/** Text a memory can be matched against — structured fields, never raw documents. */
function entityText(entity: Entity): string {
  const attrs = Object.entries(entity.attributes)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(" ") : v}`)
    .join(" ");
  return `${entity.title} ${entity.summary} ${attrs} ${entity.tags.join(" ")} ${entity.type}`;
}

function inverseDocumentFrequency(entities: Entity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    for (const word of new Set(contentWords(entityText(entity)))) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [word, count] of counts) {
    idf.set(word, Math.log(1 + entities.length / (1 + count)));
  }
  return idf;
}

function lexicalScore(
  queryWords: string[],
  entity: Entity,
  idf: Map<string, number>,
): { score: number; hits: string[] } {
  const haystack = new Set(contentWords(entityText(entity)));
  let score = 0;
  const hits: string[] = [];
  for (const word of new Set(queryWords)) {
    if (!haystack.has(word)) continue;
    score += idf.get(word) ?? 0.5;
    hits.push(word);
  }
  return { score, hits };
}

function recencyBoost(entity: Entity, now: number): number {
  const ageDays = Math.max(0, (now - Date.parse(entity.occurredAt)) / 86_400_000);
  return 1 / (1 + ageDays / 120);
}

export async function retrieve(
  question: string,
  options: RetrieveOptions = {},
): Promise<RetrievalResult> {
  const limit = options.limit ?? 8;
  const storage = getStorage();
  const intent = analyzeIntent(question);
  const all = await storage.memory.listEntities();

  if (all.length === 0) {
    return { intent, memories: [], edges: [], evidence: [] };
  }

  // Entities the question names outright are the strongest signal there is.
  const resolver = new MentionResolver();
  for (const entity of all) resolver.addEntity(entity);
  const named = new Set(resolver.resolve(question).map((k) => k.key));

  const idf = inverseDocumentFrequency(all);
  const queryWords = contentWords(question);
  const now = Date.now();

  const scored: RetrievedMemory[] = [];
  for (const entity of all) {
    const { score: lexical, hits } = lexicalScore(queryWords, entity, idf);
    const reasons: string[] = [];
    let score = lexical;

    if (named.has(entity.key)) {
      score += 6;
      reasons.push("named in the question");
    } else if (hits.length) {
      reasons.push(`matches ${hits.slice(0, 3).join(", ")}`);
    }

    if (intent.bias.includes(entity.type)) {
      score *= 1.6;
      reasons.push(`${entity.type} memory, which is what the question asks for`);
    }

    if (intent.since && entity.occurredAt >= intent.since) {
      score *= 1.5;
      reasons.push("dated inside the window asked about");
    } else if (intent.since && entity.type !== "person") {
      score *= 0.55;
    }

    if (intent.kind === "why" && entity.attributes.rationale) {
      score += 1.4;
      reasons.push("records the reasoning");
    }

    score *= 0.6 + 0.4 * entity.confidence;
    score += recencyBoost(entity, now) * 0.6;

    // A memory only counts as retrieved if the question actually reached it.
    // Without this floor, recency and confidence alone are enough to surface
    // something for a question memory knows nothing about — and the agent
    // would then answer it, which is the one thing it must never do.
    const reached = named.has(entity.key) || hits.length > 0;
    if (reached && score > 0.4) scored.push({ entity, score, reasons, hop: 0 });
  }

  scored.sort((a, b) => b.score - a.score);
  const seeds = scored.slice(0, limit);

  // Graph expansion: the answer to "why" is usually one edge away from the
  // thing the question named.
  const seedIds = seeds.map((s) => s.entity.id);
  const { entities: neighbours, edges } = await storage.memory.neighbors(seedIds);
  const seen = new Set(seedIds);

  const expanded: RetrievedMemory[] = [];
  for (const neighbour of neighbours) {
    if (seen.has(neighbour.id)) continue;
    const edge = edges.find((e) => e.fromId === neighbour.id || e.toId === neighbour.id);
    const anchor = seeds.find(
      (s) => s.entity.id === edge?.fromId || s.entity.id === edge?.toId,
    );
    if (!edge || !anchor) continue;
    expanded.push({
      entity: neighbour,
      score: anchor.score * 0.42 * edge.confidence,
      reasons: [`${edge.type.replace(/_/g, " ")} ${anchor.entity.title}`],
      hop: 1,
    });
    seen.add(neighbour.id);
  }
  expanded.sort((a, b) => b.score - a.score);

  const memories = [...seeds, ...expanded.slice(0, Math.max(4, limit - 2))];

  // Evidence is pulled from the memories that were actually used, in the order
  // those memories ranked, so the top citation belongs to the top claim.
  const eventIds: string[] = [];
  for (const memory of memories) {
    for (const source of memory.entity.sources) {
      if (!eventIds.includes(source.eventId)) eventIds.push(source.eventId);
    }
  }
  const events = await storage.raw.list({ ids: eventIds });
  const byId = new Map(events.map((e) => [e.id, e]));
  const evidence = eventIds
    .map((id) => byId.get(id))
    .filter((e): e is RawEvent => Boolean(e))
    .slice(0, options.evidenceLimit ?? 40);

  return { intent, memories, edges, evidence };
}

/** Everything the graph holds about one entity. Used by the memory panel. */
export async function expand(entityId: string) {
  const storage = getStorage();
  const entity = await storage.memory.getEntity(entityId);
  if (!entity) return null;

  const edges = await storage.memory.listRelationships(entityId);
  const relatedIds = edges.map((e) => (e.fromId === entityId ? e.toId : e.fromId));
  const related = (
    await Promise.all([...new Set(relatedIds)].map((id) => storage.memory.getEntity(id)))
  ).filter((e): e is Entity => Boolean(e));

  const evidence = await storage.raw.list({ ids: entity.sources.map((s) => s.eventId) });

  return { entity, edges, related, evidence };
}
