import type { Entity, Relationship, SourceRef } from "./types";

/**
 * Memory improves by accumulation, not replacement.
 *
 * When the same fact arrives from a second, independent source it should not
 * overwrite the first: it should raise confidence and add evidence. That is the
 * whole reason the product gets better as more tools are connected.
 */

const MAX_SOURCES = 12;
const CONFIDENCE_CEILING = 0.98;

function dedupeSources(sources: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const s of sources) {
    const k = `${s.eventId}:${s.excerpt.slice(0, 48)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, MAX_SOURCES);
}

/**
 * Noisy-or with damping. Two independent 0.7 observations are worth more than
 * either alone, but corroboration never buys certainty.
 */
export function corroborate(existing: number, incoming: number): number {
  const combined = 1 - (1 - existing) * (1 - incoming * 0.55);
  return Math.min(CONFIDENCE_CEILING, Math.max(existing, combined));
}

export function mergeEntities(existing: Entity, incoming: Entity): Entity {
  const sameEvent = existing.sources.some((s) =>
    incoming.sources.some((i) => i.eventId === s.eventId),
  );

  // Re-reading the same event is not corroboration.
  const confidence = sameEvent
    ? Math.max(existing.confidence, incoming.confidence)
    : corroborate(existing.confidence, incoming.confidence);

  const newer = incoming.occurredAt >= existing.occurredAt;

  const attributes = { ...existing.attributes };
  for (const [k, v] of Object.entries(incoming.attributes)) {
    if (v === null || v === undefined || v === "") continue;
    const missing = attributes[k] === undefined || attributes[k] === null;
    // The most recent statement wins; older ones stay visible as evidence.
    if (missing || newer) attributes[k] = v;
  }

  return {
    ...existing,
    title: existing.title.length >= incoming.title.length ? existing.title : incoming.title,
    // A newer mention only rewrites the summary if it is at least as confident:
    // a passing "Priya was in the meeting" must not overwrite her role.
    summary:
      newer && incoming.summary.length > 12 && incoming.confidence >= existing.confidence
        ? incoming.summary
        : existing.summary,
    attributes,
    confidence,
    occurredAt: newer ? incoming.occurredAt : existing.occurredAt,
    firstSeenAt:
      existing.firstSeenAt < incoming.firstSeenAt ? existing.firstSeenAt : incoming.firstSeenAt,
    lastSeenAt:
      existing.lastSeenAt > incoming.lastSeenAt ? existing.lastSeenAt : incoming.lastSeenAt,
    sources: dedupeSources([...existing.sources, ...incoming.sources]),
    tags: Array.from(new Set([...existing.tags, ...incoming.tags])),
  };
}

export function mergeRelationships(existing: Relationship, incoming: Relationship): Relationship {
  const sameEvent = existing.sources.some((s) =>
    incoming.sources.some((i) => i.eventId === s.eventId),
  );
  return {
    ...existing,
    confidence: sameEvent
      ? Math.max(existing.confidence, incoming.confidence)
      : corroborate(existing.confidence, incoming.confidence),
    note: incoming.note ?? existing.note,
    sources: dedupeSources([...existing.sources, ...incoming.sources]),
  };
}

/** Drop evidence contributed by one integration; returns null if nothing is left. */
export function withoutIntegration<T extends { sources: SourceRef[] }>(
  record: T,
  integrationId: string,
): T | null {
  const sources = record.sources.filter((s) => s.integrationId !== integrationId);
  if (sources.length === 0) return null;
  return { ...record, sources };
}
