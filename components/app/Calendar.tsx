"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { AgendaItem } from "@/lib/agenda";
import { addDays, isoDay, startOfDay } from "@/lib/memory/dates";
import type { CalendarEvent } from "@/lib/workspace/types";
import { EASE } from "@/lib/motion";
import { EventDialog, type EventDraft } from "./EventDialog";
import { useWorkspace } from "./WorkspaceProvider";
import { Action, Empty, Label, Panel, PageHead } from "./ui";

/**
 * The calendar.
 *
 * Two things share this grid and they are not the same kind of thing. Events are
 * the user's: created here, edited here, and there before any integration is
 * connected. Everything else is memory — a launch date somebody committed to in
 * a document, a review someone mentioned in Slack — which Relay found rather
 * than was told, and which it therefore shows but will not let you edit.
 *
 * The distinction is carried in one dot: blue for yours, grey for something
 * Relay read. It is the whole legend, and it does not need explaining.
 */

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const LONG_DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** Monday first: the working week is the unit people plan in. */
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const KIND_LABEL: Record<AgendaItem["kind"], string> = {
  meeting: "Meeting",
  deadline: "Deadline",
  decision: "Decided",
};

/** Six weeks of ISO days, so the grid never changes height between months. */
function monthGrid(year: number, month: number): string[] {
  const first = new Date(Date.UTC(year, month, 1));
  // getUTCDay is Sunday-based; shift it so Monday is column zero.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = addDays(isoDay(first), -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** "09:00 – 10:30", or nothing at all for an all-day event. */
function timeRange(event: CalendarEvent): string | null {
  if (event.allDay || !event.startTime) return null;
  return event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime;
}

function Day({
  day,
  month,
  events,
  memories,
  today,
  selected,
  onSelect,
  onAdd,
}: {
  day: string;
  month: number;
  events: number;
  memories: number;
  today: boolean;
  selected: boolean;
  onSelect: (day: string) => void;
  onAdd: (day: string) => void;
}) {
  const inMonth = startOfDay(day).getUTCMonth() === month;
  const total = events + memories;

  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      onDoubleClick={() => onAdd(day)}
      aria-current={today ? "date" : undefined}
      aria-label={`${LONG_DAY.format(startOfDay(day))}, ${total} item${total === 1 ? "" : "s"}`}
      className="group relative flex aspect-square items-center justify-center rounded-2xl transition-colors duration-300 hover:bg-ink/[0.03]"
    >
      {selected && (
        <motion.span
          layoutId="calendar-selected"
          className="absolute inset-0 rounded-2xl border border-ink"
          transition={{ duration: 0.42, ease: EASE.out }}
        />
      )}

      <span
        className={`relative flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13.5px] tabular-nums transition-colors duration-300 ${
          today ? "bg-ink text-paper" : inMonth ? "text-ink-70" : "text-ink-25"
        }`}
      >
        {startOfDay(day).getUTCDate()}
      </span>

      {/* Density, not a badge. Blue is yours, grey is something Relay read. */}
      {total > 0 && (
        <span className="absolute bottom-[7px] flex items-center gap-[3px]">
          {Array.from({ length: Math.min(events, 3) }, (_, i) => (
            <span
              key={`e${i}`}
              className={`block h-[3px] w-[3px] rounded-full ${today ? "bg-paper" : "bg-blue"}`}
            />
          ))}
          {Array.from({ length: Math.min(memories, 3 - Math.min(events, 3)) }, (_, i) => (
            <span
              key={`m${i}`}
              className={`block h-[3px] w-[3px] rounded-full ${
                today ? "bg-paper/60" : "bg-ink-25"
              }`}
            />
          ))}
        </span>
      )}
    </button>
  );
}

/** One of the user's events, in a list. Clicking it opens the editor. */
function EventRow({
  event,
  showDate,
  onEdit,
}: {
  event: CalendarEvent;
  showDate?: boolean;
  onEdit: () => void;
}) {
  const time = timeRange(event);
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE.out }}
    >
      <button
        type="button"
        onClick={onEdit}
        className="group -mx-3 flex w-[calc(100%+24px)] items-start gap-3.5 rounded-xl px-3 py-2 text-left transition-colors duration-300 hover:bg-ink/[0.028]"
      >
        <span className="mt-[7px] block h-[5px] w-[5px] shrink-0 rounded-full bg-blue" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] leading-[1.45] tracking-[-0.012em] text-ink-70 group-hover:text-ink">
            {event.title}
          </span>
          <span className="mt-1 block text-[12px] tabular-nums text-ink-45">
            {time ?? "All day"}
            {showDate ? ` · ${SHORT_DAY.format(startOfDay(event.date))}` : ""}
            {event.notes ? ` · ${event.notes}` : ""}
          </span>
        </span>
      </button>
    </motion.li>
  );
}

/** Something Relay read. Same shape, grey dot, not editable. */
function MemoryRow({ item, showDate }: { item: AgendaItem; showDate?: boolean }) {
  return (
    <li className="flex items-start gap-3.5 py-2">
      <span className="mt-[7px] block h-[5px] w-[5px] shrink-0 rounded-full bg-ink-25" />
      <div className="min-w-0">
        <p className="text-[14.5px] leading-[1.45] tracking-[-0.012em] text-ink-70">{item.title}</p>
        <p className="mt-1 text-[12px] tabular-nums text-ink-45">
          {KIND_LABEL[item.kind]}
          {showDate ? ` · ${SHORT_DAY.format(startOfDay(item.date))}` : ""}
          {item.detail ? ` · ${item.detail}` : ""}
        </p>
      </div>
    </li>
  );
}

export function Calendar() {
  const { events, agenda, today, addEvent, editEvent, removeEvent } = useWorkspace();

  const [cursor, setCursor] = useState(() => {
    const start = startOfDay(today);
    return { year: start.getUTCFullYear(), month: start.getUTCMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<EventDraft | null>(null);

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) map.set(event.date, (map.get(event.date) ?? 0) + 1);
    return map;
  }, [events]);

  const shift = (months: number) => {
    setCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + months, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  const goToToday = () => {
    const start = startOfDay(today);
    setCursor({ year: start.getUTCFullYear(), month: start.getUTCMonth() });
    setSelected(today);
  };

  const dayEvents = events.filter((event) => event.date === selected);
  const dayMemories = agenda?.items.filter((item) => item.date === selected) ?? [];

  const todaysEvents = events.filter((event) => event.date === today);
  const upcoming = events.filter((event) => event.date > today);

  const save = (input: Parameters<typeof addEvent>[0]) => {
    if (draft?.event) editEvent(draft.event.id, input);
    else addEvent(input);
  };

  return (
    <div className="pb-28">
      <PageHead eyebrow="Calendar" title="What the days hold.">
        Your own events, and every date Relay found in the tools you have connected.
        Double-click a day to add something, or click one to look at it.
      </PageHead>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-3 lg:content-start">
          <Panel className="px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-medium tracking-[-0.024em] text-ink">
                {MONTH_YEAR.format(new Date(Date.UTC(cursor.year, cursor.month, 1)))}
              </h2>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={goToToday}
                  className="mr-1 rounded-full px-3 py-1.5 text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-300 hover:bg-ink/[0.04] hover:text-ink"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  aria-label="Previous month"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-45 transition-colors duration-300 hover:bg-ink/[0.04] hover:text-ink"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => shift(1)}
                  aria-label="Next month"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-45 transition-colors duration-300 hover:bg-ink/[0.04] hover:text-ink"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((letter, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="pb-2 text-center text-[11px] uppercase tracking-[0.09em] text-ink-25"
                >
                  {letter}
                </span>
              ))}
            </div>

            {/* Keyed on the month, so changing month remounts the grid and it
                rises into place. Entrance only: waiting for the old month to
                animate out would put two thirds of a second between pressing
                the arrow and being able to read the answer. */}
            <motion.div
              key={`${cursor.year}-${cursor.month}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: EASE.out }}
              className="grid grid-cols-7 gap-1"
            >
              {grid.map((day) => (
                <Day
                  key={day}
                  day={day}
                  month={cursor.month}
                  events={eventsByDay.get(day) ?? 0}
                  memories={agenda?.countsByDay[day] ?? 0}
                  today={day === today}
                  selected={day === selected}
                  onSelect={setSelected}
                  onAdd={(date) => setDraft({ event: null, date })}
                />
              ))}
            </motion.div>
          </Panel>

          <Panel className="px-7 py-7" delay={0.06}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label>{LONG_DAY.format(startOfDay(selected))}</Label>
              <Action
                tone="outline"
                onClick={() => setDraft({ event: null, date: selected })}
                className="!h-[34px] !px-4 !text-[13px]"
              >
                Add event
              </Action>
            </div>

            {dayEvents.length === 0 && dayMemories.length === 0 ? (
              <div className="mt-4">
                <Empty line="Nothing on this day yet." />
              </div>
            ) : (
              <ul className="mt-4 space-y-1">
                {dayEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onEdit={() => setDraft({ event, date: event.date })}
                  />
                ))}
                {dayMemories.map((item) => (
                  <MemoryRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-3 lg:content-start">
          <Panel className="px-7 py-7" delay={0.04}>
            <Label>Today</Label>
            {todaysEvents.length === 0 && (agenda?.todays.length ?? 0) === 0 ? (
              <div className="mt-4">
                <Empty line="Nothing scheduled today." />
              </div>
            ) : (
              <ul className="mt-4 space-y-1">
                {todaysEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onEdit={() => setDraft({ event, date: event.date })}
                  />
                ))}
                {agenda?.todays.map((item) => (
                  <MemoryRow key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="px-7 py-7" delay={0.1}>
            <div className="flex items-baseline justify-between gap-4">
              <Label>Upcoming</Label>
              {upcoming.length > 0 && (
                <span className="text-[12.5px] tabular-nums text-ink-45">{upcoming.length}</span>
              )}
            </div>
            {upcoming.length === 0 ? (
              <div className="mt-4">
                <Empty line="Nothing ahead. Add an event and it will appear here in order." />
              </div>
            ) : (
              <ul className="mt-4 space-y-1">
                {upcoming.slice(0, 8).map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    showDate
                    onEdit={() => setDraft({ event, date: event.date })}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {agenda &&
            (agenda.upcomingMeetings.length > 0 || agenda.upcomingDeadlines.length > 0) && (
              <Panel className="px-7 py-7" delay={0.16}>
                <Label>Found in your tools</Label>
                <ul className="mt-3 space-y-1">
                  {agenda.upcomingDeadlines.slice(0, 4).map((item) => (
                    <MemoryRow key={item.id} item={item} showDate />
                  ))}
                  {agenda.upcomingMeetings.slice(0, 4).map((item) => (
                    <MemoryRow key={item.id} item={item} showDate />
                  ))}
                </ul>
              </Panel>
            )}
        </div>
      </div>

      <EventDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={save}
        onDelete={removeEvent}
      />
    </div>
  );
}
