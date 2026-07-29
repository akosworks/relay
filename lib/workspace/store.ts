import { PRIORITIES } from "./types";
import type { CalendarEvent, EventInput, Priority, Task, TaskInput, Workspace } from "./types";

/**
 * Where the user's own tasks and events live.
 *
 * Two maps on `globalThis`, cached the same way the memory storage and the
 * integration table are, so a hot reload does not hand out an empty workspace.
 * Swapping this for Postgres means reimplementing these functions and nothing
 * else: no route and no component knows how any of it is stored.
 *
 * Every mutation returns the whole workspace rather than the row it touched.
 * Ordering, due dates and the productivity numbers are all properties of the
 * collection, so a response that described one task would leave the caller
 * guessing at the rest — and guessing is how two surfaces start disagreeing.
 */
const CACHE_KEY = Symbol.for("relay.workspace");

interface Tables {
  tasks: Map<string, Task>;
  events: Map<string, CalendarEvent>;
  sequence: number;
}

type Global = typeof globalThis & { [CACHE_KEY]?: Tables };

function tables(): Tables {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) {
    g[CACHE_KEY] = { tasks: new Map(), events: new Map(), sequence: 0 };
  }
  return g[CACHE_KEY];
}

/** Short, sortable, and unique within a process. Good enough for one workspace. */
function nextId(prefix: string): string {
  const t = tables();
  t.sequence += 1;
  return `${prefix}_${Date.now().toString(36)}${t.sequence.toString(36)}`;
}

/**
 * Honour the id the client asked for, when it can be honoured.
 *
 * The client mints one so its optimistic row and the stored row are the same
 * row. That is a convenience for the client and nothing more, so a malformed or
 * already-used id is quietly replaced rather than rejected — the user asked to
 * create a task, not to argue about identifiers.
 */
function idFor(prefix: string, requested: unknown, taken: Map<string, unknown>): string {
  if (
    typeof requested === "string" &&
    new RegExp(`^${prefix}_[a-z0-9]{4,40}$`).test(requested) &&
    !taken.has(requested)
  ) {
    return requested;
  }
  return nextId(prefix);
}

const VALID_PRIORITIES = new Set<string>(PRIORITIES);

function cleanPriority(value: unknown): Priority | null {
  return typeof value === "string" && VALID_PRIORITIES.has(value) ? (value as Priority) : null;
}

/** `yyyy-mm-dd` or nothing. A half-parsed date is worse than an absent one. */
function cleanDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** `HH:mm` on a 24-hour clock. */
function cleanTime(value: unknown): string | null {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

// -------------------------------------------------------------------- read

/**
 * Tasks in the order the user arranged them, unfinished first.
 *
 * Completing something moves it out of the way without losing where it sat, so
 * unticking it puts it back among its neighbours rather than at the end.
 */
export function listTasks(): Task[] {
  return [...tables().tasks.values()].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.position - b.position,
  );
}

export function listEvents(): CalendarEvent[] {
  return [...tables().events.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      // All-day events head the day they belong to; timed ones run in order.
      Number(b.allDay) - Number(a.allDay) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function getWorkspace(): Workspace {
  return { tasks: listTasks(), events: listEvents() };
}

// ------------------------------------------------------------------- tasks

export function createTask(input: TaskInput): Task {
  const title = cleanText(input.title, 200);
  if (!title) throw new Error("A task needs a title.");

  const now = new Date().toISOString();
  // New tasks land at the top: the thing you just thought of is the thing you
  // are thinking about. Negative positions keep that true forever.
  const lowest = Math.min(0, ...[...tables().tasks.values()].map((t) => t.position));

  const task: Task = {
    id: idFor("task", input.id, tables().tasks),
    title,
    notes: cleanText(input.notes, 2000),
    done: input.done === true,
    dueDate: cleanDate(input.dueDate),
    priority: cleanPriority(input.priority),
    position: lowest - 1,
    createdAt: now,
    completedAt: input.done === true ? now : null,
  };

  tables().tasks.set(task.id, task);
  return task;
}

export function updateTask(id: string, patch: Partial<TaskInput>): Task | null {
  const current = tables().tasks.get(id);
  if (!current) return null;

  const next: Task = { ...current };

  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 200);
    if (!title) throw new Error("A task needs a title.");
    next.title = title;
  }
  if (patch.notes !== undefined) next.notes = cleanText(patch.notes, 2000);
  if (patch.dueDate !== undefined) next.dueDate = cleanDate(patch.dueDate);
  if (patch.priority !== undefined) next.priority = cleanPriority(patch.priority);

  if (patch.done !== undefined && patch.done !== current.done) {
    next.done = patch.done;
    // Kept, not cleared, when reopening: the stats care when work was finished,
    // and a task ticked twice was still finished once.
    next.completedAt = patch.done ? new Date().toISOString() : null;
  }

  tables().tasks.set(id, next);
  return next;
}

export function deleteTask(id: string): boolean {
  return tables().tasks.delete(id);
}

/**
 * Rewrite the manual order from a list of ids.
 *
 * Ids the caller did not mention keep their relative order behind the ones it
 * did, so a reorder of the visible list cannot silently shuffle anything
 * filtered out of view.
 */
export function reorderTasks(ids: string[]): Task[] {
  const t = tables();
  let position = 0;
  for (const id of ids) {
    const task = t.tasks.get(id);
    if (task) t.tasks.set(id, { ...task, position: position++ });
  }
  for (const task of listTasks()) {
    if (!ids.includes(task.id)) t.tasks.set(task.id, { ...task, position: position++ });
  }
  return listTasks();
}

// ------------------------------------------------------------------ events

export function createEvent(input: EventInput): CalendarEvent {
  const title = cleanText(input.title, 200);
  if (!title) throw new Error("An event needs a title.");

  const date = cleanDate(input.date);
  if (!date) throw new Error("An event needs a date.");

  const event: CalendarEvent = {
    id: idFor("evt", input.id, tables().events),
    title,
    notes: cleanText(input.notes, 2000),
    date,
    ...times(input),
    createdAt: new Date().toISOString(),
  };

  tables().events.set(event.id, event);
  return event;
}

export function updateEvent(id: string, patch: Partial<EventInput>): CalendarEvent | null {
  const current = tables().events.get(id);
  if (!current) return null;

  const next: CalendarEvent = { ...current };

  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 200);
    if (!title) throw new Error("An event needs a title.");
    next.title = title;
  }
  if (patch.notes !== undefined) next.notes = cleanText(patch.notes, 2000);
  if (patch.date !== undefined) {
    const date = cleanDate(patch.date);
    if (!date) throw new Error("An event needs a date.");
    next.date = date;
  }
  if (patch.allDay !== undefined || patch.startTime !== undefined || patch.endTime !== undefined) {
    Object.assign(next, times({ ...current, ...patch }));
  }

  tables().events.set(id, next);
  return next;
}

export function deleteEvent(id: string): boolean {
  return tables().events.delete(id);
}

/**
 * Reconcile the all-day flag with the clock.
 *
 * An all-day event has no times, and an event with no start time is an all-day
 * event whatever the flag says — otherwise the calendar has to render an event
 * that claims to be at a particular time it does not know. An end before its
 * start is dropped rather than swapped: guessing which one the user meant is
 * how an event ends up in the wrong hour.
 */
function times(input: Partial<EventInput>): Pick<CalendarEvent, "allDay" | "startTime" | "endTime"> {
  const start = cleanTime(input.startTime);
  if (input.allDay || !start) return { allDay: true, startTime: null, endTime: null };

  const end = cleanTime(input.endTime);
  return { allDay: false, startTime: start, endTime: end && end > start ? end : null };
}
