import type {
  AttributeValue,
  EntityType,
  ExtractedEntity,
  ExtractedRelationship,
  ExtractionResult,
  RawEvent,
  RelationType,
} from "@/lib/memory/types";
import { excerptOf, findDates, rationale, sentences, signature, toTitle } from "./text";
import type { KnownEntity, MentionResolver } from "./resolver";
import type { ExtractionContext, Extractor } from "./types";

/**
 * The extraction layer, done with rules rather than a model.
 *
 * It reads a raw event the way a person skimming for the important part does:
 * structured fields first (a Jira assignee is a fact, not a guess), then the
 * prose, looking for the handful of sentence shapes that carry organizational
 * meaning — someone decided something, someone owns something, something is
 * blocked on something else.
 *
 * Everything it emits is JSON with a confidence and the span of text it came
 * from. A model-backed extractor would replace the internals of this file and
 * nothing else.
 */

// ---------------------------------------------------------------- collector

class Collector {
  readonly entities = new Map<string, ExtractedEntity>();
  readonly relationships = new Map<string, ExtractedRelationship>();

  constructor(
    private readonly event: RawEvent,
    private readonly resolver: MentionResolver,
  ) {}

  entity(input: {
    type: EntityType;
    title: string;
    summary: string;
    confidence: number;
    excerpt: string;
    keyHint?: string;
    attributes?: Record<string, AttributeValue>;
    occurredAt?: string;
    tags?: string[];
    aliases?: string[];
  }): KnownEntity | null {
    const title = input.title.trim();
    if (title.length < 2 || title.length > 160) return null;

    const id = `${input.type}:${input.keyHint ?? title.toLowerCase()}`;
    const existing = this.entities.get(id);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, input.confidence);
      Object.assign(existing.attributes ?? {}, input.attributes ?? {});
    } else {
      this.entities.set(id, {
        type: input.type,
        title,
        keyHint: input.keyHint,
        summary: input.summary,
        attributes: input.attributes ?? {},
        confidence: input.confidence,
        occurredAt: input.occurredAt ?? this.event.occurredAt,
        tags: input.tags ?? [],
        excerpt: excerptOf(this.event.body, input.excerpt),
      });
    }

    // Register immediately: later rules in this same event can now resolve it.
    return this.resolver.add(input.type, title, input.aliases, input.keyHint);
  }

  link(
    type: RelationType,
    from: KnownEntity | null,
    to: KnownEntity | null,
    opts: { confidence: number; excerpt: string; note?: string },
  ) {
    if (!from || !to) return;
    if (from.key === to.key) return;
    const id = `${type}|${from.key}|${to.key}`;
    if (this.relationships.has(id)) return;
    this.relationships.set(id, {
      type,
      from: { type: from.type, title: from.title, key: from.key },
      to: { type: to.type, title: to.title, key: to.key },
      confidence: opts.confidence,
      note: opts.note,
      excerpt: excerptOf(this.event.body, opts.excerpt),
    });
  }

  result(): ExtractionResult {
    return {
      entities: [...this.entities.values()],
      relationships: [...this.relationships.values()],
    };
  }
}

// ------------------------------------------------------------------ helpers

const NAME = /^[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2}$/;

function personFrom(
  raw: string | undefined,
  c: Collector,
  confidence: number,
  excerpt: string,
  attributes: Record<string, AttributeValue> = {},
): KnownEntity | null {
  if (!raw) return null;
  // Strip the email form connectors sometimes carry: "Rui Alves <rui@...>".
  const name = raw.replace(/<[^>]*>/g, "").trim();
  if (!NAME.test(name)) return null;
  return c.entity({
    type: "person",
    title: name,
    summary: `${name} appears in company sources.`,
    confidence,
    excerpt,
    attributes,
  });
}

function cleanPhrase(phrase: string): string {
  return phrase
    .replace(/\s+/g, " ")
    .replace(/^(?:the|our|a|an|all|any)\s+/i, "")
    .split(/\s+(?:end to end|before|after|for|in|under|which|that|so)\b/i)[0]
    .replace(/[.,;:]+$/, "")
    .trim();
}

/** Resolve a noun phrase to a known entity, or mint a light one if it looks nameable. */
function resolveTarget(
  phrase: string,
  c: Collector,
  resolver: MentionResolver,
  fallbackType: EntityType,
  confidence: number,
  /** Only mint a new memory when the phrase names something, e.g. "ATLAS-214". */
  requireProper = false,
): KnownEntity | null {
  const cleaned = cleanPhrase(phrase);
  if (!cleaned) return null;

  const known = resolver.lookup(cleaned);
  if (known) return known;

  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount > 5 || cleaned.length < 3) return null;
  // "blocked on the public beta" names nothing new; "blocked on ATLAS-214" does.
  if (requireProper && !/[A-Z0-9]/.test(cleaned)) return null;

  return c.entity({
    type: fallbackType,
    title: cleaned,
    summary: `${cleaned} is referred to as a distinct piece of work.`,
    confidence,
    excerpt: phrase,
  });
}

const DECISION_CUES: { re: RegExp; confidence: number }[] = [
  { re: /\bwe(?:'ve| have| had)?\s+decided\s+(?:to\s+|that\s+)?/i, confidence: 0.86 },
  { re: /\bwe(?:'ve| have)?\s+agreed\s+(?:to\s+|that\s+)?/i, confidence: 0.82 },
  { re: /\bwe(?:'ve| have)?\s+chosen\s+(?:to\s+)?/i, confidence: 0.82 },
  { re: /\bthe decision (?:is|was)\s+(?:to\s+)?/i, confidence: 0.84 },
  { re: /\bdecision:\s*/i, confidence: 0.84 },
  { re: /\bwe are going with\s+/i, confidence: 0.78 },
  { re: /\bwe will not\b|\bwe are not\b/i, confidence: 0.6 },
];

// ------------------------------------------------------------- structural

/** Facts that come from the connector's own fields. These are not inferences. */
function structural(event: RawEvent, c: Collector): KnownEntity | null {
  const meta = event.metadata;
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : undefined);

  switch (event.sourceType) {
    case "slack.member": {
      return c.entity({
        type: "person",
        title: event.title,
        summary: `${event.title} is ${str("role") ?? "a team member"}${
          str("team") ? ` on the ${str("team")} team` : ""
        }.`,
        confidence: 0.95,
        excerpt: event.body,
        attributes: { role: str("role") ?? null, team: str("team") ?? null, handle: str("handle") ?? null },
        aliases: str("handle") ? [str("handle")!, str("handle")!.replace("@", "")] : [],
      });
    }

    case "transcript.meeting": {
      const meetingTitle = str("meeting") ?? event.title;
      const attendees = Array.isArray(meta.attendees) ? (meta.attendees as string[]) : [];
      const meeting = c.entity({
        type: "meeting",
        title: meetingTitle,
        summary: `Meeting on ${event.occurredAt.slice(0, 10)}${
          attendees.length ? ` with ${attendees.join(", ")}` : ""
        }.`,
        confidence: 0.95,
        excerpt: event.body,
        attributes: { attendees, date: event.occurredAt.slice(0, 10) },
      });
      for (const person of attendees) {
        const p = personFrom(person, c, 0.85, event.body);
        c.link("participated_in", p, meeting, {
          confidence: 0.9,
          excerpt: event.body,
          note: "listed as an attendee",
        });
      }
      // A turn's focal entity is the meeting it was said in.
      return meeting;
    }

    case "github.pull_request": {
      const feature = c.entity({
        type: "feature",
        title: event.title.replace(/^[a-z-]+#\d+\s+/i, ""),
        keyHint: event.externalId.toLowerCase(),
        summary: event.body.split(/(?<=\.)\s/)[0] ?? event.title,
        confidence: 0.9,
        excerpt: event.body,
        attributes: {
          repo: str("repo") ?? null,
          state: str("state") ?? null,
          pullRequest: event.externalId,
          author: event.author ?? null,
        },
        aliases: [event.externalId.toLowerCase()],
      });
      const author = personFrom(event.author, c, 0.9, event.body);
      c.link("assigned_to", feature, author, {
        confidence: 0.9,
        excerpt: event.body,
        note: "authored the pull request",
      });
      return feature;
    }

    case "github.issue": {
      const issue = c.entity({
        type: "issue",
        title: event.title.replace(/^[a-z-]+#\d+\s+/i, ""),
        keyHint: event.externalId.toLowerCase(),
        summary: event.body.split(/(?<=\.)\s/)[0] ?? event.title,
        confidence: 0.9,
        excerpt: event.body,
        attributes: {
          repo: str("repo") ?? null,
          state: str("state") ?? null,
          labels: Array.isArray(meta.labels) ? (meta.labels as string[]) : [],
        },
        aliases: [event.externalId.toLowerCase()],
      });
      personFrom(event.author, c, 0.85, event.body);
      return issue;
    }

    case "jira.issue":
    case "linear.issue": {
      const ticket = str("key") ?? str("identifier") ?? event.externalId;
      const status = str("status") ?? str("state") ?? null;
      const assignee = str("assignee");
      const task = c.entity({
        type: "task",
        title: event.title,
        // The ticket id is a stronger identity than the summary text.
        keyHint: ticket.toLowerCase(),
        summary: event.body.split(/(?<=\.)\s/)[0] ?? event.title,
        confidence: 0.92,
        excerpt: event.body,
        attributes: { ticket, status, assignee: assignee ?? null },
        tags: status === "Blocked" ? ["blocked"] : [],
        aliases: [ticket.toLowerCase()],
      });
      const person = personFrom(assignee, c, 0.9, event.body);
      c.link("assigned_to", task, person, {
        confidence: 0.92,
        excerpt: event.body,
        note: `assigned in ${event.sourceType === "jira.issue" ? "Jira" : "Linear"}`,
      });
      return task;
    }

    case "notion.page":
    case "gdocs.document":
    case "gdrive.file": {
      const isProcedure = /\b(process|procedure|runbook|workflow|playbook)\b/i.test(event.title);
      // "Customer onboarding process" and a Slack mention of "the onboarding
      // process" are the same procedure; key both on the trailing phrase.
      const procedureKey = event.title.match(
        /([\w-]+\s+(?:process|procedure|runbook|workflow|playbook))$/i,
      )?.[1];
      const focal = c.entity({
        type: isProcedure ? "procedure" : "document",
        title: event.title,
        keyHint: isProcedure ? procedureKey?.toLowerCase() : undefined,
        summary: event.body.split(/(?<=\.)\s/)[0] ?? event.title,
        confidence: isProcedure ? 0.88 : 0.8,
        excerpt: event.body,
        attributes: {
          author: event.author ?? null,
          space: str("space") ?? null,
          steps: isProcedure ? procedureSteps(event.body) : null,
        },
      });
      const author = personFrom(event.author, c, 0.85, event.body);
      if (isProcedure) {
        c.link("owns", author, focal, {
          confidence: 0.6,
          excerpt: event.body,
          note: "wrote the page",
        });
      }
      return focal;
    }

    case "gmail.thread": {
      const doc = c.entity({
        type: "document",
        title: event.title,
        summary: event.body.split(/(?<=\.)\s/)[0] ?? event.title,
        confidence: 0.75,
        excerpt: event.body,
        attributes: { from: str("from") ?? null, kind: "email" },
      });
      personFrom(event.author, c, 0.7, event.body);
      return doc;
    }

    case "slack.message": {
      personFrom(event.author, c, 0.8, event.body, { handle: null });
      return null;
    }

    default:
      return null;
  }
}

function procedureSteps(body: string): string[] {
  const steps = [...body.matchAll(/Step\s+\w+,\s*([^.]+)\./gi)].map((m) => m[1].trim());
  if (steps.length) return steps;
  // Chat-written procedures use commas, not numbered steps.
  const listed = body.match(/(?:steps?|short version)[:,]\s*(.+?)(?:\.|$)/i);
  return listed ? listed[1].split(/,\s*(?:then\s+)?/).map((s) => s.trim()) : [];
}

// ------------------------------------------------------------------ prose

function prose(event: RawEvent, c: Collector, ctx: ExtractionContext, focal: KnownEntity | null) {
  const resolver = ctx.resolver;

  for (const sentence of sentences(event.body)) {
    // -- named things ------------------------------------------------------
    for (const m of sentence.matchAll(/\bProject\s+([A-Z][a-z]+)\b/g)) {
      c.entity({
        type: "project",
        title: `Project ${m[1]}`,
        summary: `Project ${m[1]} is an active project at the company.`,
        confidence: 0.85,
        excerpt: sentence,
      });
    }

    for (const m of sentence.matchAll(
      /\b((?:[A-Z][a-z]+\s+)*[A-Z][a-z]+\s+(?:Health|Logistics|Systems|Technologies|Labs|Group|Industries|Partners|Solutions|Bank|Capital|Media|Inc|Ltd|LLC|GmbH))\b/g,
    )) {
      c.entity({
        type: "customer",
        title: m[1],
        summary: `${m[1]} is an external organization Relay has heard about.`,
        confidence: 0.8,
        excerpt: sentence,
      });
    }

    for (const m of sentence.matchAll(/\b([A-Z][A-Z0-9]{1,9}-\d+)\b/g)) {
      // A bare ticket id is a real thing even before its tracker is connected.
      c.entity({
        type: "task",
        title: m[1],
        keyHint: m[1].toLowerCase(),
        summary: `Work tracked as ${m[1]}.`,
        confidence: 0.6,
        excerpt: sentence,
        attributes: { ticket: m[1] },
        aliases: [m[1].toLowerCase()],
      });
    }

    for (const m of sentence.matchAll(/\b([A-Z]{2,6}(?:\s+[A-Z]{2,6})+)\b/g)) {
      c.entity({
        type: "feature",
        title: m[1],
        summary: `${m[1]} is a named capability.`,
        confidence: 0.68,
        excerpt: sentence,
      });
    }

    for (const m of sentence.matchAll(
      /\b((?:[a-z]+\s+)?[a-z]+\s+(?:process|runbook|procedure|workflow))\b/gi,
    )) {
      const phrase = m[1].toLowerCase().replace(/^(?:the|our|this|current)\s+/, "");
      if (phrase.split(/\s+/).length < 2) continue;
      const tail = phrase.match(/([\w-]+\s+(?:process|runbook|procedure|workflow))$/)?.[1];
      c.entity({
        type: "procedure",
        title: phrase.charAt(0).toUpperCase() + phrase.slice(1),
        keyHint: tail,
        summary: `How the company runs its ${phrase}.`,
        confidence: 0.7,
        excerpt: sentence,
      });
    }

    // -- decisions ---------------------------------------------------------
    for (const cue of DECISION_CUES) {
      const hit = sentence.match(cue.re);
      if (!hit || hit.index === undefined) continue;

      const clause = sentence.slice(hit.index + hit[0].length);
      const title = toTitle(clause);
      if (title.length < 8) continue;

      const why = rationale(sentence);
      const dates = findDates(sentence);
      const isMeeting = event.sourceType === "transcript.meeting";

      const decision = c.entity({
        type: "decision",
        title,
        // Two reports of one decision rarely use the same words.
        keyHint: signature(clause),
        summary: title,
        confidence: cue.confidence + (isMeeting || event.sourceType === "notion.page" ? 0.04 : 0),
        excerpt: sentence,
        attributes: {
          rationale: why,
          statedBy: event.author ?? null,
          effectiveDate: dates.at(-1) ?? null,
          previousDate: dates.length > 1 ? dates[0] : null,
          statedIn: event.title,
        },
        tags: /\bdelay|push|slip|postpone\b/i.test(sentence) ? ["delay"] : [],
      });

      const decider = personFrom(event.author, c, 0.85, sentence);
      c.link("decided_by", decision, decider, {
        confidence: isMeeting ? 0.9 : 0.8,
        excerpt: sentence,
        note: isMeeting ? "said it in the meeting" : "wrote it",
      });

      if (focal?.type === "meeting") {
        c.link("created_from", decision, focal, {
          confidence: 0.9,
          excerpt: sentence,
          note: "decided in this meeting",
        });
        for (const attendee of resolver.resolve((event.participants ?? []).join(" "), ["person"])) {
          c.link("participated_in", attendee, focal, {
            confidence: 0.85,
            excerpt: sentence,
          });
        }
      }

      for (const mention of resolver.resolve(sentence)) {
        if (mention.type === "person") continue;
        c.link(mention.type === "project" ? "affects" : "mentions", decision, mention, {
          confidence: 0.7,
          excerpt: sentence,
        });
      }
    }

    // -- ownership ---------------------------------------------------------
    for (const m of sentence.matchAll(
      /\b([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)\s+owns?\s+(?:the\s+)?([^.;]+)/g,
    )) {
      const owner = personFrom(m[1], c, 0.85, sentence);
      if (!owner) continue;
      for (const part of m[2].split(/\s+and\s+/).slice(0, 2)) {
        const target = resolveTarget(part, c, resolver, "feature", 0.72);
        c.link("owns", owner, target, {
          confidence: 0.85,
          excerpt: sentence,
          note: "stated explicitly",
        });
      }
    }

    const ownerField = sentence.match(/\bOwner:\s*([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)/);
    if (ownerField && focal) {
      const owner = personFrom(ownerField[1], c, 0.88, sentence);
      c.link("owns", owner, focal, { confidence: 0.88, excerpt: sentence, note: "named as owner" });
    }

    const ownedBy = sentence.match(/\b(?:owned by|is owned by)\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)/);
    if (ownedBy) {
      const owner = personFrom(ownedBy[1], c, 0.85, sentence);
      const subject = resolver.resolve(sentence).find((e) => e.type !== "person") ?? focal;
      c.link("owns", owner, subject, { confidence: 0.85, excerpt: sentence, note: "stated explicitly" });
    }

    const assigned = sentence.match(/\bassigned to\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)?)/i);
    if (assigned) {
      const person = personFrom(assigned[1], c, 0.85, sentence);
      const subject = resolver.resolve(sentence).find((e) => e.type !== "person") ?? focal;
      c.link("assigned_to", subject, person, { confidence: 0.85, excerpt: sentence });
    }

    // -- dependencies ------------------------------------------------------
    const subjectOf = (index: number): KnownEntity | null => {
      const before = sentence.slice(0, index);
      // Longest-alias-first, so "ATLAS-214 is blocked on ..." is about the
      // ticket and not about the project whose name it starts with.
      const found = resolver.resolve(before).filter((e) => e.type !== "person");
      return found[0] ?? focal;
    };

    for (const m of sentence.matchAll(
      /\b(?:blocked on|blocked by|depends on|depend on|gated on|waiting on|contingent on)\s+([^.;,]+)/gi,
    )) {
      const subject = subjectOf(m.index ?? 0);
      const target = resolveTarget(m[1], c, resolver, "issue", 0.62, true);
      c.link("depends_on", subject, target, {
        confidence: 0.82,
        excerpt: sentence,
        note: "stated as a dependency",
      });
    }

    for (const m of sentence.matchAll(/\b(?:blocks|is blocking|is a blocker for)\s+([^.;,]+)/gi)) {
      const subject = subjectOf(m.index ?? 0);
      const target = resolveTarget(m[1], c, resolver, "feature", 0.65, true);
      c.link("blocks", subject, target, {
        confidence: 0.82,
        excerpt: sentence,
        note: "stated as a blocker",
      });
    }

    for (const m of sentence.matchAll(
      /\bcannot\s+(?:go live|start|ship|launch|roll out|begin)[^.;]*?without\s+([^.;,]+)/gi,
    )) {
      const subject = subjectOf(m.index ?? 0);
      const target = resolveTarget(m[1], c, resolver, "feature", 0.7, true);
      c.link("depends_on", subject, target, {
        confidence: 0.84,
        excerpt: sentence,
        note: "hard requirement",
      });
    }

    for (const m of sentence.matchAll(/\brequires?\s+([^.;,]+?)\s+(?:before|for)\b/gi)) {
      const subject = subjectOf(m.index ?? 0);
      const target = resolveTarget(m[1], c, resolver, "feature", 0.7);
      c.link("depends_on", subject, target, {
        confidence: 0.8,
        excerpt: sentence,
        note: "stated as a requirement",
      });
    }
  }

  // -- everything the focal entity was mentioned alongside -----------------
  if (focal) {
    for (const mention of resolver.resolve(event.body)) {
      if (mention.key === focal.key) continue;
      const type: RelationType =
        mention.type === "project" && focal.type !== "project" ? "affects" : "mentions";
      c.link(type, focal, mention, {
        confidence: 0.58,
        excerpt: event.body,
        note: "appear in the same source",
      });
    }
  }
}

// --------------------------------------------------------------- extractor

export const heuristicExtractor: Extractor = {
  id: "heuristic-v1",
  label: "Rule-based extraction",
  description:
    "Reads structured connector fields as fact and prose for the sentence shapes that carry organizational meaning: decisions, ownership, assignment and dependency.",

  async extract(event: RawEvent, ctx: ExtractionContext): Promise<ExtractionResult> {
    const collector = new Collector(event, ctx.resolver);
    const focal = structural(event, collector);
    prose(event, collector, ctx, focal);
    return collector.result();
  },
};
