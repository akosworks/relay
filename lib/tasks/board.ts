import { isoDay, toISODate } from "@/lib/memory/dates";
import type { Entity, EntityType } from "@/lib/memory/types";
import { getStorage } from "@/lib/storage";
import { allOverrides, type TaskOverride } from "./state";

/**
 * The board, read out of memory.
 *
 * Relay does not own a task list. It owns everything the company's tools said
 * about work in flight — a pull request still open, an issue nobody closed, a
 * ticket id someone typed in a thread — and this is that, gathered onto one
 * page. Which means the board can be empty, and an empty board is the correct
 * answer when nothing is connected.
 */

/** Memory types that describe a piece of work rather than a fact about one. */
const WORK_TYPES: EntityType[] = ["task", "issue", "feature"];

/**
 * Whether a memory is a piece of work or merely the subject of some.
 *
 * "SAML SSO" and "authentication" are extracted as features because that is
 * what they are — capabilities the company talks about owning. Neither is a
 * thing anyone can finish, so neither belongs on a board that reports a
 * completion percentage. What earns a place is evidence that the work exists
 * somewhere as work: a ticket id, or a pull request with a state.
 */
function isTrackedWork(entity: Entity): boolean {
  if (entity.type !== "feature") return true;
  return Boolean(entity.attributes.pullRequest ?? entity.attributes.state);
}

const DONE_WORDS = /\b(done|closed|complete|completed|merged|shipped|resolved|landed)\b/i;

/** Nobody records estimates in chat, so remaining effort is modelled, not known. */
export const MINUTES_PER_ITEM = 45;

export interface WorkItem {
  id: string;
  type: EntityType;
  title: string;
  detail: string;
  done: boolean;
  /** Whether the state came from the source system or from the person reading it. */
  settledBy: "source" | "you";
  blocked: boolean;
  ticket: string | null;
  repo: string | null;
  assignee: string | null;
  url: string | null;
  confidence: number;
  occurredAt: string;
  /** When it was finished, when anything says. */
  completedAt: string | null;
  /**
   * A date a source named as this work's own deadline. Deliberately not
   * inferred from any date that happens to appear in the text: a summary
   * mentioning a launch date is not a summary of something due that day, and a
   * board that says "overdue" had better be right.
   */
  dueDate: string | null;
}

export interface Board {
  today: string;
  items: WorkItem[];
  open: WorkItem[];
  done: WorkItem[];
  /** Open work a source tied to today or earlier. The genuinely pressing part. */
  due: WorkItem[];
  recentlyCompleted: WorkItem[];
  total: number;
  completion: number;
  minutesPerItem: number;
  minutesRemaining: number;
}

function attributeString(entity: Entity, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = entity.attributes[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toWorkItem(entity: Entity, overrides: Map<string, TaskOverride>): WorkItem {
  const state = attributeString(entity, "state", "status");
  const due = attributeString(entity, "dueDate");
  const override = overrides.get(entity.id);
  const doneAtSource = Boolean(state && DONE_WORDS.test(state));
  const done = override ? override.done : doneAtSource;

  return {
    id: entity.id,
    type: entity.type,
    title: entity.title,
    detail: entity.summary,
    done,
    settledBy: override ? "you" : "source",
    blocked: entity.tags.includes("blocked"),
    ticket: attributeString(entity, "ticket", "pullRequest"),
    repo: attributeString(entity, "repo"),
    assignee: attributeString(entity, "assignee", "author"),
    url: entity.sources.find((source) => source.url)?.url ?? null,
    confidence: entity.confidence,
    occurredAt: entity.occurredAt,
    completedAt: override?.done
      ? override.at
      : doneAtSource
        ? entity.occurredAt
        : null,
    dueDate: due ? toISODate(due, entity.occurredAt) : null,
  };
}

export async function getBoard(now = new Date()): Promise<Board> {
  const today = isoDay(now);
  const [entities, overrides] = await Promise.all([
    getStorage().memory.listEntities({
      type: WORK_TYPES,
      // Below this a "task" is usually a ticket id someone typed in passing with
      // nothing else known about it. Real, but not something to put on a board.
      minConfidence: 0.6,
    }),
    allOverrides(),
  ]);

  const items = entities
    .filter(isTrackedWork)
    .map((entity) => toWorkItem(entity, overrides))
    .sort((a, b) => b.confidence - a.confidence || b.occurredAt.localeCompare(a.occurredAt));

  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  return {
    today,
    items,
    open,
    done,
    due: open.filter((item) => item.dueDate !== null && item.dueDate <= today),
    recentlyCompleted: [...done].sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    ),
    total: items.length,
    completion: items.length === 0 ? 0 : done.length / items.length,
    minutesPerItem: MINUTES_PER_ITEM,
    minutesRemaining: open.length * MINUTES_PER_ITEM,
  };
}
