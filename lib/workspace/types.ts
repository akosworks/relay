/**
 * The user's own data.
 *
 * Everything else in Relay is memory — things it read somewhere and can cite.
 * This is the opposite: things a person typed, which Relay did not learn and
 * must never rewrite. Keeping the two apart is what lets the product say "I
 * know this because Slack said so" about one and "you told me" about the other,
 * and it is why these live outside the memory graph rather than as entities in it.
 */

/** How much a task matters. Three levels, because a fourth never gets used. */
export const PRIORITIES = ["high", "medium", "low"] as const;

export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  done: boolean;
  /** `yyyy-mm-dd`, when the user gave one. */
  dueDate: string | null;
  priority: Priority | null;
  /** Manual order within the list. Fractional, so an insert never renumbers. */
  position: number;
  createdAt: string;
  completedAt: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string | null;
  /** `yyyy-mm-dd`. Events are single-day; a range would need a second date. */
  date: string;
  allDay: boolean;
  /** `HH:mm`, both null when `allDay`. */
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
}

/** Everything the user owns, in one payload. The client holds exactly this. */
export interface Workspace {
  tasks: Task[];
  events: CalendarEvent[];
}

// ------------------------------------------------------------------- input

/**
 * `id` is optional and supplied by the client.
 *
 * It exists so an optimistic row and the row the server sends back are the same
 * row. Without it the two have different keys, React unmounts one and mounts the
 * other, and for the length of an exit animation the list shows the task twice.
 * The store treats a supplied id as a request, not a promise: anything malformed
 * or already taken gets one of its own instead.
 */
export interface TaskInput {
  id?: string;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  priority?: Priority | null;
  done?: boolean;
}

export interface EventInput {
  id?: string;
  title: string;
  notes?: string | null;
  date: string;
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
}
