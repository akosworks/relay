import type { EntityType } from "./types";

/**
 * Identity in the memory layer is derived, not random: two mentions of
 * "Project Atlas" from Slack and from a transcript must land on the same
 * entity, or the graph fragments and the agent starts contradicting itself.
 */

/** Lowercase, strip punctuation and filler so surface variants collapse. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/^(the|a|an|project|our)\s+/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function entityKey(type: EntityType, title: string): string {
  return `${type}:${normalize(title)}`;
}

/** Deterministic id from a key, so ids are stable across restarts and reseeds. */
export function stableId(prefix: string, ...parts: string[]): string {
  const input = parts.join("|");
  // FNV-1a: short, dependency-free, and good enough for fixture-scale data.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}_${hash.toString(36).padStart(7, "0")}`;
}

export function entityId(type: EntityType, title: string): string {
  return stableId("ent", entityKey(type, title));
}

export function relationshipId(type: string, fromId: string, toId: string): string {
  return stableId("rel", type, fromId, toId);
}

export function eventId(integrationId: string, externalId: string): string {
  return stableId("evt", integrationId, externalId);
}
