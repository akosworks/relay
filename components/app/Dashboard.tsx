"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { startOfDay } from "@/lib/memory/dates";
import { isTodays } from "@/lib/workspace/stats";
import { EASE } from "@/lib/motion";
import { useNow } from "@/lib/useClock";
import { useAsk } from "./Ask";
import { EntityDrawer } from "./EntityDrawer";
import { TaskCheck } from "./TaskRow";
import { useWorkspace } from "./WorkspaceProvider";
import {
  Bar,
  Counter,
  Empty,
  Label,
  Panel,
  PriorityMark,
  relativeDate,
  Ring,
  StatusDot,
  TYPE_LABEL,
} from "./ui";

/**
 * Home.
 *
 * The heart of the product, and the only page that shows everything at once:
 * what is on you, what is coming, how the day is going, and what Relay has been
 * reading. Every panel is a view of the shared store rather than its own fetch,
 * which is why ticking a task here moves the ring here, and moves it on the
 * tasks page too, without either of them asking the server what happened.
 *
 * Asking is the first thing on the page, because it is the product. The field
 * does not navigate anywhere — it opens the overlay over this, so a question
 * never costs you your place.
 */

const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Morning, afternoon, evening. The one thing a greeting should get right. */
function greeting(now: Date | null): string {
  if (!now) return "Welcome back";
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Dashboard() {
  const { tasks, events, stats, overview, agenda, today, toggleTask } = useWorkspace();
  const { openAsk } = useAsk();
  const [draft, setDraft] = useState("");
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const now = useNow();

  const connected = overview?.integrations.filter((i) => i.status !== "disconnected") ?? [];

  // Today's open work, most urgent first: overdue, then dated, then the rest.
  const todaysTasks = tasks
    .filter((task) => isTodays(task, today))
    .sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      const rank = { high: 0, medium: 1, low: 2 } as const;
      const byDate = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      if (byDate !== 0) return byDate;
      return (a.priority ? rank[a.priority] : 3) - (b.priority ? rank[b.priority] : 3);
    });

  const upcoming = events.filter((event) => event.date >= today).slice(0, 5);

  const submitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const question = draft.trim();
    if (!question) return;
    setDraft("");
    openAsk(question);
  };

  return (
    <>
      <div className="pb-28">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE.out }}
          className="pb-14 pt-16 sm:pt-24"
        >
          <h1 className="display text-[clamp(2rem,4vw,2.9rem)]">{greeting(now)}.</h1>
          <p className="mt-4 h-[1.6em] text-[16px] leading-[1.6] tracking-[-0.014em] text-ink-45">
            {now && DAY.format(now)}
            {stats.today.total > 0 && (
              <>
                {" · "}
                {stats.today.remaining === 0
                  ? "everything on today is done"
                  : `${stats.today.remaining} ${
                      stats.today.remaining === 1 ? "task" : "tasks"
                    } left today`}
              </>
            )}
          </p>

          {/* Not a link and not a page. Typing here and pressing return opens the
              overlay with the question already asked. */}
          <form onSubmit={submitQuestion} className="relative mt-10 max-w-[600px]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => {
                // Focusing the field is a request to ask something, so the real
                // surface comes forward straight away and takes the keystrokes.
                if (!draft) openAsk();
              }}
              placeholder="Ask Relay something…"
              aria-label="Ask Relay something"
              className="h-[54px] w-full rounded-full border border-rule bg-paper pl-6 pr-[58px] text-[16px] tracking-[-0.013em] text-ink shadow-soft outline-none transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-ink-25 hover:border-ink-25 focus:border-blue focus:shadow-lift"
            />
            <button
              type="submit"
              aria-label="Ask"
              className="absolute right-[7px] top-[7px] flex h-[40px] w-[40px] items-center justify-center rounded-full bg-ink text-paper transition-all duration-400 hover:bg-blue"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </motion.header>

        <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
          <div className="grid gap-3 lg:content-start">
            {/* ------------------------------------------------ today's tasks */}
            <Panel className="px-7 py-7" delay={0.05}>
              <div className="flex items-baseline justify-between gap-4">
                <Label>Today&rsquo;s tasks</Label>
                <Link
                  href="/tasks"
                  className="text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-400 hover:text-blue"
                >
                  {tasks.length > 0 ? "All tasks →" : "Add tasks →"}
                </Link>
              </div>

              {todaysTasks.length === 0 ? (
                <div className="mt-4">
                  <Empty
                    line={
                      tasks.length === 0
                        ? "No tasks yet. Relay keeps your list whether or not anything is connected."
                        : "Nothing on today. Everything you have is either done or dated later."
                    }
                    action={tasks.length === 0 ? "Add your first task" : undefined}
                    href="/tasks"
                  />
                </div>
              ) : (
                <ul className="mt-4">
                  <AnimatePresence initial={false}>
                    {todaysTasks.slice(0, 6).map((task) => (
                      <motion.li
                        key={task.id}
                        layout="position"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: EASE.out }}
                        className="flex items-start gap-3.5 py-2.5"
                      >
                        <div className="mt-[1px]">
                          <TaskCheck
                            done={task.done}
                            onToggle={() => toggleTask(task.id)}
                            label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-[15px] leading-[1.45] tracking-[-0.013em] transition-colors duration-500 ${
                              task.done ? "text-ink-25 line-through" : "text-ink-70"
                            }`}
                          >
                            {task.title}
                          </p>
                          {(task.dueDate || task.priority) && (
                            <p className="mt-1 flex items-center gap-2.5 text-[12px] text-ink-45">
                              {task.priority && <PriorityMark level={task.priority} />}
                              {task.dueDate && (
                                <span
                                  className={
                                    !task.done && task.dueDate < today
                                      ? "text-blue"
                                      : "tabular-nums"
                                  }
                                >
                                  {!task.done && task.dueDate < today ? "overdue · " : ""}
                                  {relativeDate(task.dueDate)}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {todaysTasks.length > 6 && (
                <p className="mt-3 text-[12.5px] text-ink-45">
                  and {todaysTasks.length - 6} more
                </p>
              )}
            </Panel>

            {/* --------------------------------------------- recent activity */}
            <Panel className="px-7 py-7" delay={0.12}>
              <Label>Recent activity</Label>
              {!overview || overview.recent.length === 0 ? (
                <div className="mt-4">
                  <Empty
                    line="Relay has not learned anything yet. Connect a source and what it reads will appear here."
                    action={connected.length === 0 ? "Connect a source" : undefined}
                    href="/integrations"
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-0.5">
                  {overview.recent.slice(0, 5).map((memory, i) => (
                    <motion.li
                      key={memory.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.16 + i * 0.05, ease: EASE.out }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenEntity(memory.id)}
                        className="group -mx-3 w-[calc(100%+24px)] rounded-xl px-3 py-2 text-left transition-colors duration-300 hover:bg-ink/[0.025]"
                      >
                        <p className="truncate text-[14.5px] tracking-[-0.012em] text-ink-70 group-hover:text-ink">
                          {memory.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-45">
                          {TYPE_LABEL[memory.type]} · {memory.sources} source
                          {memory.sources === 1 ? "" : "s"} · {relativeDate(memory.occurredAt)}
                        </p>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid gap-3 lg:content-start">
            {/* --------------------------------------------------- the numbers */}
            <Panel className="px-7 py-7" delay={0.08}>
              <div className="flex items-baseline justify-between gap-4">
                <Label>Progress</Label>
                <Link
                  href="/tasks"
                  className="text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-400 hover:text-blue"
                >
                  Details →
                </Link>
              </div>

              <div className="mt-5 flex items-center gap-7">
                <Ring value={stats.today.progress} size={104} stroke={3}>
                  <span className="text-[22px] font-medium leading-none tracking-[-0.032em] text-ink">
                    <Counter value={Math.round(stats.today.progress * 100)} suffix="%" />
                  </span>
                  <span className="mt-1 text-[10.5px] uppercase tracking-[0.09em] text-ink-25">
                    Today
                  </span>
                </Ring>

                <dl className="min-w-0 flex-1 space-y-2.5 text-[13.5px]">
                  <Row label="Done today" value={stats.today.done} />
                  <Row label="Remaining" value={stats.today.remaining} />
                  <Row label="This week" value={stats.week.completed} />
                  {stats.overdue > 0 && <Row label="Overdue" value={stats.overdue} accent />}
                </dl>
              </div>

              <div className="mt-6">
                <Bar value={stats.completionRate} />
                <p className="mt-2.5 text-[12px] tabular-nums text-ink-45">
                  {stats.completed} of {stats.total} tasks completed all told
                </p>
              </div>
            </Panel>

            {/* ------------------------------------------------ upcoming events */}
            <Panel className="px-7 py-7" delay={0.14}>
              <div className="flex items-baseline justify-between gap-4">
                <Label>Upcoming</Label>
                <Link
                  href="/calendar"
                  className="text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-400 hover:text-blue"
                >
                  Calendar →
                </Link>
              </div>

              {upcoming.length === 0 && (agenda?.upcomingDeadlines.length ?? 0) === 0 ? (
                <div className="mt-4">
                  <Empty
                    line="Nothing ahead. Add an event on the calendar and it will show up here."
                    action="Open the calendar"
                    href="/calendar"
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {upcoming.map((event) => (
                      <motion.li
                        key={event.id}
                        layout="position"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.4, ease: EASE.out }}
                        className="flex gap-3.5"
                      >
                        <span className="mt-[6px] block h-[5px] w-[5px] shrink-0 rounded-full bg-blue" />
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] tracking-[-0.012em] text-ink-70">
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-[12px] tabular-nums text-ink-45">
                            {event.date === today
                              ? "Today"
                              : SHORT_DAY.format(startOfDay(event.date))}
                            {event.allDay || !event.startTime
                              ? " · all day"
                              : ` · ${event.startTime}`}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>

                  {/* Dates Relay found rather than dates you set. Grey, like
                      everywhere else it shows something it read. */}
                  {agenda?.upcomingDeadlines.slice(0, 2).map((item) => (
                    <li key={item.id} className="flex gap-3.5">
                      <span className="mt-[6px] block h-[5px] w-[5px] shrink-0 rounded-full bg-ink-25" />
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] tracking-[-0.012em] text-ink-70">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[12px] tabular-nums text-ink-45">
                          Deadline · {relativeDate(item.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {/* --------------------------------------------------- integrations */}
            <Panel className="px-7 py-7" delay={0.2}>
              <div className="flex items-baseline justify-between gap-4">
                <Label>Learning from</Label>
                <Link
                  href="/integrations"
                  className="text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-400 hover:text-blue"
                >
                  Manage →
                </Link>
              </div>

              {connected.length === 0 ? (
                <div className="mt-4">
                  <Empty
                    line="Nothing is connected. Relay knows only what it has been given access to."
                    action="Connect a source"
                    href="/integrations"
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {connected.map((integration, i) => (
                    <motion.li
                      key={integration.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.24 + i * 0.04, ease: EASE.out }}
                      className="flex items-center gap-3 text-[14px]"
                    >
                      <StatusDot status={integration.status} />
                      <span className="flex-1 truncate tracking-[-0.012em] text-ink-70">
                        {integration.name}
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-ink-45">
                        {integration.memories}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>

      <EntityDrawer
        entityId={openEntity}
        onClose={() => setOpenEntity(null)}
        onOpenEntity={setOpenEntity}
        onAsk={(question) => {
          setOpenEntity(null);
          openAsk(question);
        }}
      />
    </>
  );
}

/** One line of the progress readout. The number changes; the label does not. */
function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="flex-1 text-ink-45">{label}</dt>
      <dd className={accent ? "text-blue" : "text-ink-70"}>
        <Counter value={value} />
      </dd>
    </div>
  );
}
