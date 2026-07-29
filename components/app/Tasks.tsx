"use client";

import { AnimatePresence, motion, Reorder } from "motion/react";
import { useState } from "react";
import type { Task } from "@/lib/workspace/types";
import { isTodays } from "@/lib/workspace/stats";
import { EASE } from "@/lib/motion";
import { useNow } from "@/lib/useClock";
import { TaskComposer } from "./TaskComposer";
import { TaskRow } from "./TaskRow";
import { useWorkspace } from "./WorkspaceProvider";
import { Bar, Counter, Empty, Label, Panel, PageHead, Ring, Stat, TYPE_LABEL } from "./ui";

/**
 * The tasks page.
 *
 * A real list: type at the top, tick things off, drag them into the order you
 * mean to do them in. Everything here belongs to the user, works with nothing
 * connected, and is the only thing the numbers above it are computed from — so
 * they are always true, and they move the moment anything does.
 *
 * Work still open in connected tools sits in its own panel underneath, clearly
 * separate and read-only. Relay did not create it and cannot delete it; showing
 * it beside your own list would be pretending otherwise.
 */

const WORKDAY = { start: 9, end: 18 };

/** Filters, in the order somebody actually wants them. */
const VIEWS = [
  { id: "today", label: "Today" },
  { id: "all", label: "All" },
  { id: "done", label: "Completed" },
] as const;

type View = (typeof VIEWS)[number]["id"];

function duration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

/** How much of the working day is left, on the reader's clock. */
function workdayLeft(now: Date): { minutes: number; elapsed: number } {
  const minutesIn = now.getHours() * 60 + now.getMinutes();
  const start = WORKDAY.start * 60;
  const end = WORKDAY.end * 60;
  return {
    minutes: Math.max(0, Math.min(end, end - minutesIn)),
    elapsed: Math.max(0, Math.min(1, (minutesIn - start) / (end - start))),
  };
}

export function Tasks() {
  const workspace = useWorkspace();
  const { tasks, stats, today, ready, error } = workspace;
  const [view, setView] = useState<View>("today");
  const clock = useNow();

  const visible = tasks.filter((task) => {
    if (view === "all") return true;
    if (view === "done") return task.done;
    return isTodays(task, today);
  });

  // Reorder writes the order of the list the user can actually see; the store
  // keeps everything else behind it, in the order it already had.
  const onReorder = (next: Task[]) => {
    workspace.reorderTasks(next.map((task) => task.id));
  };

  const left = clock ? workdayLeft(clock) : null;

  return (
    <div className="pb-28">
      <PageHead eyebrow="Tasks" title="What you are getting done.">
        Your list, and how today is going. Nothing here needs an integration —
        type a task and Relay keeps it.
      </PageHead>

      {/* -------------------------------------------------------- the numbers */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.05fr]">
        <Panel className="px-7 py-8 sm:px-9">
          <div className="flex items-center gap-9">
            <Ring value={stats.today.progress} size={124}>
              <span className="text-[26px] font-medium leading-none tracking-[-0.035em] text-ink">
                <Counter value={Math.round(stats.today.progress * 100)} suffix="%" />
              </span>
              <span className="mt-1.5 text-[11px] uppercase tracking-[0.09em] text-ink-25">
                Today
              </span>
            </Ring>

            <div className="min-w-0 flex-1">
              <p className="text-[15.5px] leading-[1.5] tracking-[-0.013em] text-ink-70">
                {stats.today.total === 0
                  ? "Nothing on today."
                  : stats.today.remaining === 0
                    ? `All ${stats.today.total} done. That is the day.`
                    : `${stats.today.done} of ${stats.today.total} done, ${stats.today.remaining} to go.`}
              </p>
              <Bar value={stats.today.progress} className="mt-4" />
              <p className="mt-3 text-[12.5px] tabular-nums text-ink-45">
                {stats.overdue > 0 && <span className="text-blue">{stats.overdue} overdue · </span>}
                {stats.dueToday > 0 && <>{stats.dueToday} due today · </>}
                {left && left.minutes > 0
                  ? `${duration(left.minutes)} left in the workday`
                  : "The workday is over"}
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="px-7 py-8 sm:px-9" delay={0.06}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
            <Stat value={<Counter value={stats.remaining} />} label="Remaining" />
            <Stat value={<Counter value={stats.completed} />} label="Completed" />
            <Stat value={<Counter value={stats.total} />} label="Total" />
            <Stat
              value={<Counter value={Math.round(stats.completionRate * 100)} suffix="%" />}
              label="Completion rate"
              tone="quiet"
            />
          </div>

          <div className="mt-8 border-t border-rule pt-6">
            <div className="flex items-baseline justify-between">
              <Label>This week</Label>
              <span className="text-[12.5px] tabular-nums text-ink-45">
                {stats.week.completed} finished
              </span>
            </div>
            <div className="mt-4 flex h-[52px] items-end gap-1.5">
              {stats.week.days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <motion.div
                    className={`w-full rounded-[3px] ${day.today ? "bg-blue" : "bg-ink/[0.14]"}`}
                    initial={{ height: 2 }}
                    animate={{ height: Math.max(2, (day.count / stats.week.best) * 34) }}
                    transition={{ duration: 0.55, ease: EASE.out }}
                  />
                  <span
                    className={`text-[10.5px] ${day.today ? "text-ink-70" : "text-ink-25"}`}
                    aria-label={`${day.count} on ${day.date}`}
                  >
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ----------------------------------------------------------- the list */}
      <Panel className="mt-3 px-7 py-7" delay={0.1}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={view === option.id}
                className={`relative rounded-full px-3.5 py-1.5 text-[13.5px] tracking-[-0.011em] transition-colors duration-300 ${
                  view === option.id ? "text-ink" : "text-ink-45 hover:text-ink"
                }`}
              >
                {view === option.id && (
                  <motion.span
                    layoutId="task-view"
                    className="absolute inset-0 rounded-full bg-ink/[0.055]"
                    transition={{ duration: 0.36, ease: EASE.out }}
                  />
                )}
                <span className="relative">{option.label}</span>
              </button>
            ))}
          </div>
          <span className="text-[12.5px] tabular-nums text-ink-45">
            {visible.length} {visible.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div className="mt-5">
          <TaskComposer today={today} onCreate={workspace.addTask} />
        </div>

        {error && <p className="mt-4 text-[13.5px] text-blue">{error}</p>}

        {visible.length === 0 ? (
          <div className="mt-6">
            <Empty
              line={
                !ready
                  ? "Loading your list…"
                  : tasks.length === 0
                    ? "No tasks yet. Type one above — Relay will keep it, and everything on this page is worked out from it."
                    : view === "done"
                      ? "Nothing completed yet."
                      : "Nothing on today. Anything with no date, or dated today or earlier, shows up here."
              }
            />
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={visible}
            onReorder={onReorder}
            className="mt-2 divide-y divide-rule"
          >
            <AnimatePresence initial={false}>
              {visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  onToggle={() => workspace.toggleTask(task.id)}
                  onEdit={(patch) => workspace.editTask(task.id, patch)}
                  onRemove={() => workspace.removeTask(task.id)}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </Panel>

      <ToolWork />
    </div>
  );
}

/**
 * Work that is open somewhere else.
 *
 * Read out of memory rather than typed, so it is presented as what it is: a
 * report on the user's tools, not part of their list. It is kept out of the
 * statistics above for the same reason — those describe what the person is
 * doing, and nobody wants their completion rate set by a pull request queue.
 */
function ToolWork() {
  const { board, busyWorkItem, toggleWorkItem } = useWorkspace();

  if (!board || board.total === 0) return null;

  return (
    <Panel className="mt-3 px-7 py-7" delay={0.14}>
      <div className="flex items-baseline justify-between gap-4">
        <Label>Open in your tools</Label>
        <span className="text-[12.5px] tabular-nums text-ink-45">
          {board.open.length} of {board.total} open
        </span>
      </div>
      <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.6] text-ink-45">
        Pulled from what Relay has read in your connected sources. Not part of your list,
        and not counted in the numbers above.
      </p>

      <ul className="mt-4 divide-y divide-rule">
        {board.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3.5 py-3">
            <button
              type="button"
              onClick={() => toggleWorkItem(item.id)}
              role="checkbox"
              aria-checked={item.done}
              aria-label={`${item.done ? "Reopen" : "Complete"} ${item.title}`}
              disabled={busyWorkItem === item.id}
              className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-300 ${
                item.done
                  ? "border-ink-45 bg-ink-45 text-paper"
                  : "border-ink-25 text-transparent hover:border-ink"
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M2.5 6.4 4.7 8.6 9.5 3.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <p
                className={`text-[14.5px] leading-[1.45] tracking-[-0.012em] ${
                  item.done ? "text-ink-25 line-through" : "text-ink-70"
                }`}
              >
                {item.title}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2.5 text-[12px] text-ink-45">
                <span className="uppercase tracking-[0.08em] text-ink-25">
                  {TYPE_LABEL[item.type]}
                </span>
                {item.ticket && <span className="tabular-nums">{item.ticket}</span>}
                {item.repo && <span>{item.repo}</span>}
                {item.assignee && <span>{item.assignee}</span>}
                {item.blocked && <span className="text-blue">blocked</span>}
              </p>
            </div>

            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${item.title} in its source`}
                className="mt-[2px] shrink-0 text-[13px] text-ink-25 transition-colors duration-400 hover:text-blue"
              >
                ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
