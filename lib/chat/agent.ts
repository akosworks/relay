import type { Entity, Relationship } from "@/lib/memory/types";
import { analyzeIntent } from "@/lib/retrieval/intent";
import { expand, retrieve, type RetrievedMemory } from "@/lib/retrieval";
import { getStorage } from "@/lib/storage";
import {
  attr,
  attrList,
  Composer,
  edgesFrom,
  edgesTo,
  humanDate,
  other,
} from "./compose";
import { Context } from "./context";
import { isModelConfigured, runChat, type ChatMessage, type ModelReply } from "./model";
import { buildSystemPrompt, SCOPE_REMINDER, wrapQuestion } from "./prompt";
import { runTool, TOOLS } from "./tools";
import type { AnswerBlock, ChatAnswer, ChatTurn, UsedMemory } from "./types";

/**
 * The agent.
 *
 * One agent, one job: answer from memory and show its working. It reasons over
 * structured memories and the edges between them — never over raw documents —
 * and every sentence it produces is attached to the evidence that supports it.
 * When memory has nothing, it says so; that honesty is the product.
 *
 * Retrieval gives it a ranked starting point. From there it walks the graph
 * around whatever the question is really about, because the answer to "why"
 * is almost always one edge away from the thing the question named.
 */

class Ctx {
  readonly byId = new Map<string, Entity>();
  edges: Relationship[] = [];
  private hydrated = new Set<string>();

  constructor(
    readonly question: string,
    readonly memories: RetrievedMemory[],
    edges: Relationship[],
    readonly composer: Composer,
  ) {
    this.edges = [...edges];
    for (const m of memories) this.byId.set(m.entity.id, m.entity);
  }

  lookup(id: string | undefined): Entity | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  /** Pull one entity's full neighbourhood into scope. Cheap and idempotent. */
  async hydrate(entity: Entity | undefined): Promise<void> {
    if (!entity || this.hydrated.has(entity.id)) return;
    this.hydrated.add(entity.id);

    const expanded = await expand(entity.id);
    if (!expanded) return;

    this.byId.set(entity.id, expanded.entity);
    for (const related of expanded.related) {
      if (!this.byId.has(related.id)) this.byId.set(related.id, related);
    }
    for (const edge of expanded.edges) {
      if (!this.edges.some((e) => e.id === edge.id)) this.edges.push(edge);
    }
  }

  first(type: Entity["type"]): Entity | undefined {
    return this.memories.find((m) => m.entity.type === type)?.entity;
  }

  all(type: Entity["type"]): Entity[] {
    return this.memories.filter((m) => m.entity.type === type).map((m) => m.entity);
  }
}

/** People on the far end of an edge type, e.g. who decided this. */
function peopleFor(ctx: Ctx, entity: Entity, type: string): Entity[] {
  const edges = [...edgesFrom(ctx.edges, entity.id, type), ...edgesTo(ctx.edges, entity.id, type)];
  return edges
    .map((edge) => ctx.lookup(other(edge, entity.id)))
    .filter((e): e is Entity => e?.type === "person");
}

function joinNames(entities: Entity[]): string {
  const names = [...new Set(entities.map((e) => e.title))];
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// ------------------------------------------------------------------ shapes

async function answerWhy(ctx: Ctx): Promise<boolean> {
  const decisions = ctx.all("decision");
  const decision = decisions.find((d) => d.attributes.rationale) ?? decisions[0];
  if (!decision) return false;

  await ctx.hydrate(decision);
  const c = ctx.composer;

  c.say(`${decision.title}.`, decision);

  const why = attr(decision, "rationale");
  if (why) c.say(`The reason recorded at the time: ${why}.`, decision);

  const from = attr(decision, "previousDate");
  const to = attr(decision, "effectiveDate");
  if (from && to) c.say(`The date moved from ${from} to ${to}.`, decision);

  const deciders = peopleFor(ctx, decision, "decided_by");
  const meetingEdge = edgesFrom(ctx.edges, decision.id, "created_from")[0];
  const meeting = ctx.lookup(meetingEdge?.toId);
  if (deciders.length) {
    c.say(
      `Decided by ${joinNames(deciders)}${meeting ? ` in ${meeting.title}` : ""} on ${humanDate(
        decision.occurredAt,
      )}.`,
      meetingEdge ?? decision,
    );
  }

  // What the decision was actually waiting on, one hop further out.
  const affected = edgesFrom(ctx.edges, decision.id, "affects")
    .map((e) => ctx.lookup(e.toId))
    .filter((e): e is Entity => Boolean(e));

  for (const subject of affected.slice(0, 2)) {
    await ctx.hydrate(subject);
    for (const dep of edgesFrom(ctx.edges, subject.id, "depends_on").slice(0, 3)) {
      const target = ctx.lookup(dep.toId);
      if (!target) continue;
      const status = attr(target, "status");
      c.say(
        `${subject.title} depends on ${target.title}${status ? ` (${status.toLowerCase()})` : ""}.`,
        dep,
        "bullet",
      );
    }
  }

  return !c.isEmpty;
}

async function answerWhoOwns(ctx: Ctx): Promise<boolean> {
  const c = ctx.composer;
  const named = ctx.memories.filter(
    (m) => m.hop === 0 && m.reasons.includes("named in the question"),
  );
  const candidates = [...named, ...ctx.memories].map((m) => m.entity);

  for (const target of candidates.slice(0, 6)) {
    if (target.type === "person") continue;
    await ctx.hydrate(target);

    const owns = edgesTo(ctx.edges, target.id, "owns")[0];
    const owner = ctx.lookup(owns?.fromId);
    if (!owns || owner?.type !== "person") continue;

    c.say(`${owner.title} owns ${target.title}.`, owns);

    const role = attr(owner, "role");
    const team = attr(owner, "team");
    if (role) c.say(`${owner.title} is ${role}${team ? ` on the ${team} team` : ""}.`, owner);

    // Recent proof of that ownership, rather than the claim on its own.
    await ctx.hydrate(owner);
    const work = [
      ...edgesTo(ctx.edges, owner.id, "assigned_to"),
      ...edgesTo(ctx.edges, owner.id, "decided_by"),
    ];
    let shown = 0;
    for (const edge of work) {
      const item = ctx.lookup(edge.fromId);
      if (!item || item.id === target.id || shown >= 3) continue;
      const status = attr(item, "status");
      c.say(`${item.title}${status ? ` — ${status.toLowerCase()}` : ""}.`, item, "bullet");
      shown += 1;
    }
    return !c.isEmpty;
  }

  return false;
}

async function answerHow(ctx: Ctx): Promise<boolean> {
  // Prefer the procedure someone actually wrote down step by step.
  const procedures = ctx.all("procedure");
  const procedure =
    procedures.find((p) => attrList(p, "steps").length > 1) ?? procedures[0];
  if (!procedure) return false;

  await ctx.hydrate(procedure);
  const c = ctx.composer;
  const steps = attrList(procedure, "steps");

  c.say(
    steps.length > 1
      ? `${procedure.title} has ${steps.length} steps.`
      : procedure.summary,
    procedure,
  );

  for (const step of steps.slice(0, 8)) {
    c.say(step.charAt(0).toUpperCase() + step.slice(1), procedure, "bullet");
  }

  const ownerEdge = edgesTo(ctx.edges, procedure.id, "owns")[0];
  const owner = ctx.lookup(ownerEdge?.fromId);
  if (owner) c.say(`${owner.title} owns this process.`, ownerEdge);

  return !c.isEmpty;
}

async function answerSummarize(ctx: Ctx): Promise<boolean> {
  const subject =
    ctx.memories.find((m) => m.hop === 0 && m.entity.type === "project")?.entity ??
    ctx.memories.find((m) => m.hop === 0)?.entity;
  if (!subject) return false;

  await ctx.hydrate(subject);
  const c = ctx.composer;

  const related = ctx.edges
    .filter((e) => e.fromId === subject.id || e.toId === subject.id)
    .map((edge) => ({ edge, entity: ctx.lookup(other(edge, subject.id)) }))
    .filter((r): r is { edge: Relationship; entity: Entity } => Boolean(r.entity));

  const group = (type: Entity["type"]) => {
    const seen = new Set<string>();
    return related.filter((r) => {
      if (r.entity.type !== type || seen.has(r.entity.id)) return false;
      seen.add(r.entity.id);
      return true;
    });
  };

  const decisions = group("decision");
  const tasks = group("task");
  const people = group("person");
  const customers = group("customer");

  const counts = [
    decisions.length ? `${decisions.length} decision${decisions.length > 1 ? "s" : ""}` : null,
    tasks.length ? `${tasks.length} piece${tasks.length > 1 ? "s" : ""} of tracked work` : null,
    people.length ? `${people.length} people` : null,
  ].filter(Boolean);

  c.say(
    `${subject.summary}${
      counts.length ? ` Memory links it to ${counts.join(", ")}.` : ""
    }`,
    subject,
  );

  for (const { entity } of decisions.slice(0, 3)) {
    c.say(`Decision: ${entity.title}.`, entity, "bullet");
  }
  for (const { entity } of tasks.slice(0, 3)) {
    const status = attr(entity, "status");
    c.say(`${entity.title}${status ? ` — ${status.toLowerCase()}` : ""}.`, entity, "bullet");
  }
  for (const { edge, entity } of people.slice(0, 3)) {
    c.say(`${entity.title} — ${edge.type.replace(/_/g, " ")}.`, edge, "bullet");
  }
  for (const { entity } of customers.slice(0, 2)) {
    c.say(`${entity.title} is involved.`, entity, "bullet");
  }

  return !c.isEmpty;
}

/** Types worth reporting as "a change". Stubs and passing mentions are not. */
const CHANGE_TYPES = new Set(["decision", "task", "issue", "procedure", "meeting", "feature"]);

async function answerChanged(ctx: Ctx, since: string): Promise<boolean> {
  const c = ctx.composer;
  const all = await getStorage().memory.listEntities();
  const recent = all
    .filter(
      (e) => e.occurredAt >= since && CHANGE_TYPES.has(e.type) && e.confidence >= 0.72,
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 7);

  if (recent.length === 0) return false;

  c.sayAcross(
    `Since ${humanDate(since)} memory has learned or updated ${recent.length} things.`,
    recent.slice(0, 3),
  );
  for (const entity of recent) {
    const status = attr(entity, "status");
    c.say(
      `${humanDate(entity.occurredAt)} — ${entity.title}${status ? ` (${status.toLowerCase()})` : ""}.`,
      entity,
      "bullet",
    );
  }
  return !c.isEmpty;
}

async function answerWhen(ctx: Ctx): Promise<boolean> {
  const c = ctx.composer;
  const dated = ctx.memories
    .map((m) => m.entity)
    .find((e) => attr(e, "effectiveDate") || e.type === "meeting");
  if (!dated) return false;

  const date = attr(dated, "effectiveDate") ?? humanDate(dated.occurredAt);
  c.say(`${dated.title}: ${date}.`, dated);
  const previous = attr(dated, "previousDate");
  if (previous) c.say(`It was previously ${previous}.`, dated);
  return !c.isEmpty;
}

async function answerGeneral(ctx: Ctx): Promise<boolean> {
  const c = ctx.composer;
  const top = ctx.memories[0]?.entity;
  if (!top) return false;

  await ctx.hydrate(top);
  c.say(top.summary, top);

  // What memory knows *about* the subject beats a list of other memories that
  // merely matched the same words.
  const links = ctx.edges
    .filter((e) => e.fromId === top.id || e.toId === top.id)
    .filter((e) => e.type !== "mentions")
    .slice(0, 4);

  for (const edge of links) {
    const node = ctx.lookup(other(edge, top.id));
    if (!node) continue;
    const outward = edge.fromId === top.id;
    const relation = edge.type.replace(/_/g, " ");
    c.say(
      outward
        ? `${top.title} ${relation} ${node.title}${edge.note ? ` — ${edge.note}` : ""}.`
        : `${node.title} ${relation} ${top.title}${edge.note ? ` — ${edge.note}` : ""}.`,
      edge,
      "bullet",
    );
  }

  if (links.length === 0) {
    for (const memory of ctx.memories.slice(1, 4)) {
      const entity = memory.entity;
      const role = attr(entity, "role");
      // Titles and summaries converge on some memories; don't say it twice.
      const detail =
        entity.summary.startsWith(entity.title) || entity.type === "person"
          ? role ?? entity.summary
          : entity.summary;
      c.say(`${entity.title} — ${detail}`, entity, "bullet");
    }
  }

  return !c.isEmpty;
}

// ---------------------------------------------------------------- follow-ups

/**
 * Follow-ups are drawn from the memories the answer actually used, not from
 * everything retrieval touched — offering to explain something the answer
 * never mentioned reads as a non sequitur.
 */
function followUps(question: string, used: UsedMemory[]): string[] {
  const out: string[] = [];
  const seen = new Set([question.toLowerCase()]);
  const push = (q: string) => {
    if (out.length < 3 && !seen.has(q.toLowerCase())) {
      out.push(q);
      seen.add(q.toLowerCase());
    }
  };

  const solid = used.filter((m) => m.confidence >= 0.75);
  const pick = (type: UsedMemory["type"]) => solid.find((m) => m.type === type);

  const project = pick("project");
  const feature = pick("feature");
  const person = pick("person");
  const customer = pick("customer");
  const decision = pick("decision");

  if (project) push(`What is blocking ${project.title}?`);
  if (customer) push(`What does ${customer.title} need from us?`);
  if (feature) push(`Who owns ${feature.title}?`);
  if (person) push(`What has ${person.title.split(" ")[0]} been working on?`);
  if (decision) push(`What led to the decision to ${decision.title.toLowerCase()}?`);
  push("What changed in the last month?");
  return out;
}

/** "since last month's planning meeting" means since that meeting, not 30 days. */
function windowStart(ctx: Ctx, fallback?: string): string {
  const meeting = ctx.memories.find(
    (m) => m.entity.type === "meeting" && m.reasons.includes("named in the question"),
  )?.entity;
  return meeting?.occurredAt ?? fallback ?? new Date(Date.now() - 35 * 86_400_000).toISOString();
}

// -------------------------------------------------------------------- entry

/** How many rounds of tool calls before the agent must answer with what it has. */
const MAX_TOOL_ROUNDS = 4;

/**
 * Turn the model's prose into blocks, lifting `[n]` markers out of the text and
 * onto the block that carried them. A citation the context never issued is
 * dropped rather than rendered: a number pointing at nothing is worse than no
 * number, because it looks like evidence.
 */
function toBlocks(text: string, valid: Set<number>): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];

  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;

    const kind: AnswerBlock["kind"] = /^[-*•]\s+/.test(line) ? "bullet" : "paragraph";
    const cited = [...line.matchAll(/\[(\d+)\]/g)]
      .map((m) => Number(m[1]))
      .filter((n) => valid.has(n));

    const body = line
      .replace(/^[-*•]\s+/, "")
      .replace(/\[\d+\]/g, "")
      .replace(/\s+([.,;:])/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (body) blocks.push({ kind, text: body, citations: [...new Set(cited)] });
  }

  return blocks;
}

function fallback(text: string): ChatAnswer["blocks"] {
  return [{ kind: "paragraph", text, citations: [] }];
}

/**
 * Answer a question.
 *
 * Retrieval runs first and unconditionally: the model never sees the question
 * without also seeing what memory holds about it, so its default state is
 * informed rather than imaginative. From there it may search again or sync a
 * source, but every route to a fact goes back through retrieval — which is what
 * makes "memory has nothing on that" a reachable answer instead of a promise.
 */
export async function ask(question: string, history: ChatTurn[] = []): Promise<ChatAnswer> {
  const answeredAt = () => new Date().toISOString();
  const intent = analyzeIntent(question);

  if (!isModelConfigured()) {
    return {
      question,
      intent: intent.kind,
      blocks: fallback("No language model is configured, so I cannot answer right now."),
      citations: [],
      memories: [],
      edges: [],
      confidence: 0,
      grounded: false,
      followUps: [],
      answeredAt: answeredAt(),
    };
  }

  const context = new Context();
  const opening = context.absorb(await retrieve(question), "MEMORY FOR THIS QUESTION");

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...history.map(
      (turn): ChatMessage => ({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content,
      }),
    ),
    { role: "system", content: opening },
    { role: "user", content: wrapQuestion(question) },
    { role: "system", content: SCOPE_REMINDER },
  ];

  /** Answer the pending tool calls, so the conversation is well-formed again. */
  const settle = async (pending: ModelReply) => {
    messages.push({
      role: "assistant",
      content: pending.content,
      tool_calls: pending.toolCalls,
    });
    for (const call of pending.toolCalls) {
      const outcome = await runTool(
        call.function.name,
        call.function.arguments,
        context,
        question,
      );
      messages.push({ role: "tool", content: outcome.text, tool_call_id: call.id });
    }
    // The boundary is restated after every tool round: tool output is the most
    // recent thing the model read, and it is the easiest place for it to drift.
    messages.push({ role: "system", content: SCOPE_REMINDER });
  };

  let reply = await runChat(messages, TOOLS);

  for (let round = 0; round < MAX_TOOL_ROUNDS && reply?.toolCalls.length; round += 1) {
    await settle(reply);
    reply = await runChat(messages, TOOLS);
  }

  // A model that spends its last round calling tools leaves no prose behind.
  // Withdrawing the tools removes the option and forces the answer it already
  // has the material for — silence here would read as "memory has nothing",
  // which is a different and much worse claim.
  if (!reply?.content?.trim()) {
    if (reply?.toolCalls.length) await settle(reply);
    messages.push({
      role: "system",
      content:
        "Answer now, in prose, from the memory blocks above. No more tools. If " +
        "those blocks do not cover the question, say plainly that memory holds " +
        "nothing on it.",
    });
    reply = await runChat(messages);
  }

  const { citations, memories, edges, confidence } = context.result;
  const valid = new Set(citations.map((c) => c.index));
  const text = reply?.content?.trim() ?? "";

  const blocks = text
    ? toBlocks(text, valid)
    : fallback("I could not produce an answer to that. Try asking it another way.");

  // Cited claims are what memory carried. A block-free or citation-free answer
  // is an admission, and the UI is told so rather than left to guess.
  const grounded = memories.length > 0 && blocks.some((b) => b.citations.length > 0);

  return {
    question,
    intent: intent.kind,
    blocks: blocks.length ? blocks : fallback(text || "I have nothing on that."),
    citations: citations.filter((c) => blocks.some((b) => b.citations.includes(c.index))),
    memories,
    edges,
    confidence: grounded ? confidence : 0,
    grounded,
    followUps: grounded ? followUps(question, memories) : [],
    answeredAt: answeredAt(),
  };
}
