import { entityKey } from "@/lib/memory/keys";
import type { Entity, EntityType } from "@/lib/memory/types";

/**
 * Mention resolution.
 *
 * The difference between a search engine and a memory is that "Priya", "Priya
 * Raman" and "@priya" are one person, and every later sentence about her lands
 * on the same node. The resolver holds the aliases that make that true, and it
 * grows during ingestion as new entities are learned.
 */

export interface KnownEntity {
  key: string;
  type: EntityType;
  title: string;
  aliases: string[];
}

const TICKET_RE = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;

function aliasesFor(type: EntityType, title: string, extra: string[] = []): string[] {
  const out = new Set<string>([title.toLowerCase(), ...extra.map((e) => e.toLowerCase())]);

  if (type === "person") {
    const parts = title.split(/\s+/);
    // First names are how people are addressed in chat; last names rarely alone.
    if (parts.length > 1 && parts[0].length > 2) out.add(parts[0].toLowerCase());
  }

  if (type === "project") {
    out.add(title.replace(/^project\s+/i, "").toLowerCase());
  }

  if (type === "task" || type === "issue" || type === "feature") {
    const ticket = title.match(TICKET_RE);
    if (ticket) out.add(ticket[1].toLowerCase());
    const pr = title.match(/\b([a-z][a-z0-9-]*#\d+)\b/i);
    if (pr) out.add(pr[1].toLowerCase());
  }

  if (type === "meeting") {
    // People say "the planning meeting", not "the Q3 planning meeting".
    const m = title.match(/([\w-]+\s+(?:meeting|review|standup|retro|sync))$/i);
    if (m) out.add(m[1].toLowerCase());
  }

  if (type === "procedure") {
    const m = title.match(/([\w-]+\s+(?:process|procedure|runbook|workflow))$/i);
    if (m) out.add(m[1].toLowerCase());
  }

  return [...out].filter((a) => a.length >= 3);
}

export class MentionResolver {
  private byAlias = new Map<string, KnownEntity>();
  private byKey = new Map<string, KnownEntity>();

  add(
    type: EntityType,
    title: string,
    extraAliases: string[] = [],
    keyHint?: string,
  ): KnownEntity {
    // The key must match the one storage will use, or edges resolve to nothing.
    const key = entityKey(type, keyHint ?? title);
    const existing = this.byKey.get(key);
    const aliases = aliasesFor(type, title, extraAliases);

    const known: KnownEntity = existing
      ? { ...existing, aliases: [...new Set([...existing.aliases, ...aliases])] }
      : { key, type, title, aliases };

    this.byKey.set(key, known);
    for (const alias of known.aliases) {
      // First writer wins: a later, vaguer entity must not steal "atlas".
      if (!this.byAlias.has(alias)) this.byAlias.set(alias, known);
    }
    return known;
  }

  /** Rehydrate from storage, where the key is already decided and authoritative. */
  addEntity(entity: Entity) {
    const extra: string[] = [];
    const handle = entity.attributes.handle;
    if (typeof handle === "string") extra.push(handle, handle.replace("@", ""));
    for (const field of ["ticket", "pullRequest"] as const) {
      const value = entity.attributes[field];
      if (typeof value === "string") extra.push(value);
    }

    const existing = this.byKey.get(entity.key);
    const aliases = [
      ...new Set([...(existing?.aliases ?? []), ...aliasesFor(entity.type, entity.title, extra)]),
    ];
    const known: KnownEntity = { key: entity.key, type: entity.type, title: entity.title, aliases };

    this.byKey.set(entity.key, known);
    for (const alias of aliases) {
      if (!this.byAlias.has(alias)) this.byAlias.set(alias, known);
    }
  }

  /** Every distinct entity mentioned in the text, longest alias first. */
  resolve(text: string, types?: EntityType[]): KnownEntity[] {
    const haystack = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
    const seen = new Map<string, KnownEntity>();

    const aliases = [...this.byAlias.keys()].sort((a, b) => b.length - a.length);
    for (const alias of aliases) {
      const known = this.byAlias.get(alias)!;
      if (types && !types.includes(known.type)) continue;
      if (seen.has(known.key)) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack)) {
        seen.set(known.key, known);
      }
    }
    return [...seen.values()];
  }

  /**
   * Resolve a noun phrase to a single entity.
   *
   * `resolve` already returns longest-matched-alias first, which is the signal
   * that matters: in "ATLAS-214" the alias `atlas-214` beats `atlas`, so the
   * phrase resolves to the ticket rather than to the project it belongs to.
   */
  lookup(phrase: string, types?: EntityType[]): KnownEntity | null {
    return this.resolve(phrase, types)[0] ?? null;
  }

  has(type: EntityType, title: string): boolean {
    return this.byKey.has(entityKey(type, title));
  }

  size(): number {
    return this.byKey.size;
  }
}
