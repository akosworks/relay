import { addDays, isoDay, toISODate } from "@/lib/memory/dates";
import type { Entity, EntityType } from "@/lib/memory/types";
import { getStorage } from "@/lib/storage";

/**
 * The calendar, read out of memory.
 *
 * Relay is not a calendar client and does not hold a schedule of its own. What
 * it holds is everything the company said about dates — a launch moved to 13
 * August, a review on Friday, a decision made on the tenth — so the calendar is
 * a projection of memory onto days rather than a separate store. Nothing here
 * invents a date: an item appears only because a source committed to one.
 */

export type AgendaKind = "meeting" | "deadline" | "decision";

export interface AgendaItem {
  id: string;
  kind: AgendaKind;
  type: EntityType;
  title: string;
  /** One line of context: who is in it, or why the date moved. */
  detail: string | null;
  /** `yyyy-mm-dd`. The day this item belongs to. */
  date: string;
  confidence: number;
  attendees: string[];
}

export interface Agenda {
  /** The server's today, so the client and the data agree on "upcoming". */
  today: string;
  items: AgendaItem[];
  /** Items dated today, in the order the day runs. */
  todays: AgendaItem[];
  upcomingMeetings: AgendaItem[];
  upcomingDeadlines: AgendaItem[];
  /** How many items each day holds, for the month grid. */
  countsByDay: Record<string, number>;
}

function attributeString(entity: Entity, key: string): string | null {
  const value = entity.attributes[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function attendeesOf(entity: Entity): string[] {
  const value = entity.attributes.attendees;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function meetingItem(entity: Entity): AgendaItem | null {
  const date = attributeString(entity, "date") ?? entity.occurredAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const attendees = attendeesOf(entity);
  const mentionedIn = attributeString(entity, "mentionedIn");
  return {
    id: entity.id,
    kind: "meeting",
    type: entity.type,
    title: entity.title,
    // Where it was heard about, said as such: a bare document title next to a
    // meeting name reads as the meeting's location, which it is not.
    detail: attendees.length
      ? attendees.join(", ")
      : mentionedIn
        ? `mentioned in ${mentionedIn}`
        : null,
    date,
    confidence: entity.confidence,
    attendees,
  };
}

/**
 * A deadline is a date something was committed to, not a date something
 * happened — the difference is whether a source names a date other than its
 * own. "We are moving the launch to 13 August" is a deadline; "we shipped it"
 * is a decision.
 */
function deadlineItem(entity: Entity): AgendaItem | null {
  const written = attributeString(entity, "dueDate") ?? attributeString(entity, "effectiveDate");
  if (!written) return null;
  const date = toISODate(written, entity.occurredAt);
  if (!date) return null;

  const previous = attributeString(entity, "previousDate");
  return {
    id: entity.id,
    kind: "deadline",
    type: entity.type,
    title: entity.title,
    detail: previous
      ? `Moved from ${previous}`
      : attributeString(entity, "rationale"),
    date,
    confidence: entity.confidence,
    attendees: [],
  };
}

function decisionItem(entity: Entity): AgendaItem {
  return {
    id: entity.id,
    kind: "decision",
    type: entity.type,
    title: entity.title,
    detail: attributeString(entity, "statedBy"),
    date: entity.occurredAt.slice(0, 10),
    confidence: entity.confidence,
    attendees: [],
  };
}

export async function getAgenda(now = new Date()): Promise<Agenda> {
  const today = isoDay(now);
  const entities = await getStorage().memory.listEntities({ minConfidence: 0.6 });

  const items: AgendaItem[] = [];
  for (const entity of entities) {
    if (entity.type === "meeting") {
      const meeting = meetingItem(entity);
      if (meeting) items.push(meeting);
      continue;
    }

    const deadline = deadlineItem(entity);
    if (deadline) {
      items.push(deadline);
      continue;
    }

    // A decision without a date of its own still happened on a day, and a month
    // that shows when things were decided is worth reading.
    if (entity.type === "decision") items.push(decisionItem(entity));
  }

  items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const countsByDay: Record<string, number> = {};
  for (const item of items) {
    countsByDay[item.date] = (countsByDay[item.date] ?? 0) + 1;
  }

  // "Upcoming" ends somewhere. A quarter out is far enough that nothing real
  // gets hidden and near enough that the list stays a list.
  const horizon = addDays(today, 92);
  const ahead = (item: AgendaItem) => item.date >= today && item.date <= horizon;

  return {
    today,
    items,
    todays: items.filter((item) => item.date === today),
    upcomingMeetings: items.filter((item) => item.kind === "meeting" && ahead(item)),
    upcomingDeadlines: items.filter((item) => item.kind === "deadline" && ahead(item)),
    countsByDay,
  };
}
