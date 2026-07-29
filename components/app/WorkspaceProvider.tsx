"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "@/lib/client/api";
import type { Agenda } from "@/lib/agenda";
import type { MemoryOverview } from "@/lib/memory/overview";
import type { Board } from "@/lib/tasks/board";
import { computeStats, type Stats } from "@/lib/workspace/stats";
import type {
  CalendarEvent,
  EventInput,
  Task,
  TaskInput,
  Workspace,
} from "@/lib/workspace/types";
import { localDay } from "@/lib/memory/dates";
import { useNow } from "@/lib/useClock";

/**
 * One state, four surfaces.
 *
 * The dashboard, the calendar, the tasks page and the Ask overlay are views of
 * the same thing, so they read from one store held above all of them in the
 * layout. There is no second copy to fall out of date and nothing to refresh:
 * completing a task mutates this array, and the ring on the dashboard, the count
 * in the header and the list on the tasks page all re-render from it in the same
 * pass.
 *
 * Two kinds of data live here and they are not interchangeable. `tasks` and
 * `events` belong to the user — Relay stores them and never invents them.
 * `agenda`, `overview` and `board` are memory: derived from what Relay read in
 * connected tools, read-only, and empty until something is connected. Every
 * mutation is optimistic against the first kind and then reconciled with the
 * server's reply, because a checkbox that waits for a network round trip feels
 * broken even when it is working.
 */

interface WorkspaceState {
  /** Today, on the reader's clock. Every date comparison in the UI uses this. */
  today: string;
  ready: boolean;

  tasks: Task[];
  events: CalendarEvent[];
  stats: Stats;

  agenda: Agenda | null;
  overview: MemoryOverview | null;
  board: Board | null;

  /** Set when the last write failed, so a surface can say so and move on. */
  error: string | null;

  addTask: (input: TaskInput) => Promise<void>;
  editTask: (id: string, patch: Partial<TaskInput>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  reorderTasks: (order: string[]) => Promise<void>;

  addEvent: (input: EventInput) => Promise<void>;
  editEvent: (id: string, patch: Partial<EventInput>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;

  /**
   * Tick off work that lives in a connected tool. Not a task — memory owns it,
   * so this records the user's view on top rather than editing what the source
   * said. Kept here so the board has exactly one copy, like everything else.
   */
  toggleWorkItem: (id: string) => Promise<void>;
  /** The work item currently being written, so its row can show it is busy. */
  busyWorkItem: string | null;

  /** Re-read memory. Called after a source is connected or a question answered. */
  refreshMemory: () => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}

/**
 * An id the store will accept as-is: the prefix it expects, then hex.
 *
 * `randomUUID` where it exists, and a plain random fallback where it does not —
 * a collision only costs the server rejecting the suggestion and issuing its own.
 */
function newId(prefix: "task" | "evt"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(16).slice(2).padEnd(16, "0");
  return `${prefix}_${random.slice(0, 20)}`;
}

/** Sorted the way the store sorts, so an optimistic list matches the real one. */
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position);
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>({ tasks: [], events: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [board, setBoard] = useState<Board | null>(null);

  const now = useNow();
  // The reader's calendar day, not the server's. Every due date and every
  // "today" in the interface is compared against this one string.
  const today = localDay(now ?? new Date());

  const refreshMemory = useCallback(() => {
    api.fetchAgenda().then(setAgenda).catch(() => setAgenda(null));
    api.fetchOverview().then(setOverview).catch(() => setOverview(null));
    api.fetchBoard().then(setBoard).catch(() => setBoard(null));
  }, []);

  useEffect(() => {
    api
      .fetchWorkspace()
      .then(setWorkspace)
      .catch(() => setError("Your tasks and events could not be loaded."))
      .finally(() => setReady(true));
    refreshMemory();
  }, [refreshMemory]);

  /**
   * Apply a change locally, then let the server's answer replace it.
   *
   * The optimistic result is a guess at what the store will do; the reply is
   * what it did. On failure the previous state is restored rather than left
   * half-applied, because a list that disagrees with the server is worse than a
   * list that did not change.
   */
  const commit = useCallback(
    async (optimistic: (current: Workspace) => Workspace, request: () => Promise<Workspace>) => {
      let previous: Workspace = { tasks: [], events: [] };
      setWorkspace((current) => {
        previous = current;
        return optimistic(current);
      });
      setError(null);

      try {
        setWorkspace(await request());
      } catch (cause) {
        setWorkspace(previous);
        setError(cause instanceof Error ? cause.message : "That change could not be saved.");
      }
    },
    [],
  );

  const addTask = useCallback(
    async (input: TaskInput) => {
      // The id is decided here, not by the server, so the row drawn immediately
      // and the row that comes back are the same row — one key, one mount, one
      // entrance animation, and never the same task on screen twice.
      const id = newId("task");
      const lowest = Math.min(0, ...workspace.tasks.map((t) => t.position));
      const draft: Task = {
        id,
        title: input.title.trim(),
        notes: input.notes ?? null,
        done: false,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? null,
        position: lowest - 1,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await commit(
        (current) => ({ ...current, tasks: sortTasks([...current.tasks, draft]) }),
        () => api.createTask({ ...input, id }),
      );
    },
    [commit, workspace.tasks],
  );

  const editTask = useCallback(
    async (id: string, patch: Partial<TaskInput>) => {
      await commit(
        (current) => ({
          ...current,
          tasks: sortTasks(
            current.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
          ),
        }),
        () => api.updateTask(id, patch),
      );
    },
    [commit],
  );

  const removeTask = useCallback(
    async (id: string) => {
      await commit(
        (current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }),
        () => api.deleteTask(id),
      );
    },
    [commit],
  );

  const toggleTask = useCallback(
    async (id: string) => {
      const task = workspace.tasks.find((t) => t.id === id);
      if (!task) return;
      const done = !task.done;
      await commit(
        (current) => ({
          ...current,
          tasks: sortTasks(
            current.tasks.map((t) =>
              t.id === id
                ? { ...t, done, completedAt: done ? new Date().toISOString() : null }
                : t,
            ),
          ),
        }),
        () => api.updateTask(id, { done }),
      );
    },
    [commit, workspace.tasks],
  );

  const reorderTasks = useCallback(
    async (order: string[]) => {
      await commit(
        (current) => ({
          ...current,
          tasks: sortTasks(
            current.tasks.map((task) => {
              const at = order.indexOf(task.id);
              return at < 0 ? task : { ...task, position: at };
            }),
          ),
        }),
        () => api.reorderTasks(order),
      );
    },
    [commit],
  );

  const addEvent = useCallback(
    async (input: EventInput) => {
      const id = newId("evt");
      const allDay = input.allDay || !input.startTime;
      const draft: CalendarEvent = {
        id,
        title: input.title.trim(),
        notes: input.notes ?? null,
        date: input.date,
        allDay,
        startTime: allDay ? null : (input.startTime ?? null),
        endTime: allDay ? null : (input.endTime ?? null),
        createdAt: new Date().toISOString(),
      };
      await commit(
        (current) => ({ ...current, events: sortEvents([...current.events, draft]) }),
        () => api.createEvent({ ...input, id }),
      );
    },
    [commit],
  );

  const editEvent = useCallback(
    async (id: string, patch: Partial<EventInput>) => {
      await commit(
        (current) => ({
          ...current,
          events: sortEvents(
            current.events.map((event) => (event.id === id ? { ...event, ...patch } : event)),
          ),
        }),
        () => api.updateEvent(id, patch),
      );
    },
    [commit],
  );

  const removeEvent = useCallback(
    async (id: string) => {
      await commit(
        (current) => ({ ...current, events: current.events.filter((event) => event.id !== id) }),
        () => api.deleteEvent(id),
      );
    },
    [commit],
  );

  const [busyWorkItem, setBusyWorkItem] = useState<string | null>(null);

  const toggleWorkItem = useCallback(
    async (id: string) => {
      const item = board?.items.find((i) => i.id === id);
      if (!item) return;
      setBusyWorkItem(id);
      try {
        setBoard(await api.setWorkDone(id, !item.done));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That change could not be saved.");
      } finally {
        setBusyWorkItem(null);
      }
    },
    [board],
  );

  const stats = useMemo(() => computeStats(workspace.tasks, today), [workspace.tasks, today]);

  const value = useMemo<WorkspaceState>(
    () => ({
      today,
      ready,
      tasks: workspace.tasks,
      events: workspace.events,
      stats,
      agenda,
      overview,
      board,
      error,
      addTask,
      editTask,
      removeTask,
      toggleTask,
      reorderTasks,
      addEvent,
      editEvent,
      removeEvent,
      toggleWorkItem,
      busyWorkItem,
      refreshMemory,
    }),
    [
      addEvent,
      addTask,
      agenda,
      board,
      busyWorkItem,
      editEvent,
      editTask,
      error,
      overview,
      ready,
      refreshMemory,
      removeEvent,
      removeTask,
      reorderTasks,
      stats,
      today,
      toggleTask,
      toggleWorkItem,
      workspace.events,
      workspace.tasks,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
