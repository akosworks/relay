import { addDays } from "@/lib/memory/dates";
import type { Task } from "./types";

/**
 * The productivity numbers.
 *
 * A pure function of the task list and what day it is, deliberately: the client
 * holds the tasks, so recomputing on every change costs nothing and every figure
 * on screen is derived from the same array in the same render. Nothing is
 * fetched, which is why a ticked checkbox moves the ring immediately and why the
 * dashboard and the tasks page can never disagree.
 *
 * The day has to be passed in. "Completed today" means today where the person
 * is sitting, and the server is not sitting there.
 */

export interface DayBar {
  date: string;
  /** Single letter for the axis. Monday is "M". */
  label: string;
  count: number;
  today: boolean;
}

export interface Stats {
  total: number;
  completed: number;
  remaining: number;
  /** Completed as a share of everything. 0 when there is nothing. */
  completionRate: number;

  /**
   * Today's working set: open work that is due now or carries no date, plus
   * anything finished today. Work due later is not today's problem and is left
   * out, or the number would never move.
   */
  today: {
    total: number;
    done: number;
    remaining: number;
    progress: number;
  };

  overdue: number;
  dueToday: number;

  /** The last seven days, oldest first, for the weekly bars. */
  week: {
    completed: number;
    days: DayBar[];
    /** The busiest day in the window, so the bars have something to scale to. */
    best: number;
  };
}

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Whether a task counts as part of today, by the rules described above. */
export function isTodays(task: Task, today: string): boolean {
  if (task.done) return task.completedAt?.slice(0, 10) === today;
  return task.dueDate === null || task.dueDate <= today;
}

export function computeStats(tasks: Task[], today: string): Stats {
  const completed = tasks.filter((t) => t.done);
  const remaining = tasks.filter((t) => !t.done);

  const todays = tasks.filter((t) => isTodays(t, today));
  const todaysDone = todays.filter((t) => t.done).length;

  // Seven days ending today, so the rightmost bar is the day in progress.
  const start = addDays(today, -6);
  const byDay = new Map<string, number>();
  for (const task of completed) {
    const day = task.completedAt?.slice(0, 10);
    if (day && day >= start && day <= today) {
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
  }

  const days: DayBar[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return {
      date,
      label: LETTERS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      count: byDay.get(date) ?? 0,
      today: date === today,
    };
  });

  return {
    total: tasks.length,
    completed: completed.length,
    remaining: remaining.length,
    completionRate: tasks.length === 0 ? 0 : completed.length / tasks.length,

    today: {
      total: todays.length,
      done: todaysDone,
      remaining: todays.length - todaysDone,
      progress: todays.length === 0 ? 0 : todaysDone / todays.length,
    },

    overdue: remaining.filter((t) => t.dueDate !== null && t.dueDate < today).length,
    dueToday: remaining.filter((t) => t.dueDate === today).length,

    week: {
      completed: days.reduce((sum, d) => sum + d.count, 0),
      days,
      best: Math.max(1, ...days.map((d) => d.count)),
    },
  };
}
