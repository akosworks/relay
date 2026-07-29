"use client";

import { useState } from "react";
import type { CalendarEvent, EventInput } from "@/lib/workspace/types";
import { Action, Dialog, Field, FIELD } from "./ui";

/**
 * Making or changing an event.
 *
 * One sheet for both, because they are the same form and a separate "edit" dialog
 * would only be the same fields with different copy. All-day is the default: most
 * things people put on a calendar in a hurry do not have a time yet, and asking
 * for one before it exists is how a calendar ends up full of 9:00 placeholders.
 */

export interface EventDraft {
  /** The event being changed, or null when this is a new one. */
  event: CalendarEvent | null;
  /** The day the sheet opens on. */
  date: string;
}

export function EventDialog({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: EventDraft | null;
  onClose: () => void;
  onSave: (input: EventInput) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog
      open={draft !== null}
      onClose={onClose}
      title={draft?.event ? "Edit event" : "New event"}
    >
      {draft && (
        // Keyed on what is being edited, so opening the sheet on a different
        // event remounts the form with that event's values. Resetting the fields
        // from an effect would work too, one render late and one bug away.
        <EventForm
          key={draft.event?.id ?? `new-${draft.date}`}
          draft={draft}
          onClose={onClose}
          onSave={onSave}
          onDelete={onDelete}
        />
      )}
    </Dialog>
  );
}

function EventForm({
  draft,
  onClose,
  onSave,
  onDelete,
}: {
  draft: EventDraft;
  onClose: () => void;
  onSave: (input: EventInput) => void;
  onDelete: (id: string) => void;
}) {
  const event = draft.event;
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? draft.date);
  const [allDay, setAllDay] = useState(event ? event.allDay : true);
  const [startTime, setStartTime] = useState(event?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "10:00");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) {
      setProblem("Give the event a name.");
      return;
    }
    if (!allDay && endTime <= startTime) {
      setProblem("The end time needs to be after the start.");
      return;
    }

    onSave({
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      notes: notes.trim() || null,
    });
    onClose();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      <Field label="Name">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Design review"
          autoFocus
          className={FIELD}
        />
      </Field>

      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${FIELD} tabular-nums`}
        />
      </Field>

      <button
        type="button"
        onClick={() => setAllDay((v) => !v)}
        role="switch"
        aria-checked={allDay}
        className="flex w-full items-center gap-3 text-left"
      >
        <span
          className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-300 ${
            allDay ? "bg-ink" : "bg-rule"
          }`}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-paper transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              allDay ? "left-[19px]" : "left-[3px]"
            }`}
          />
        </span>
        <span className="text-[14.5px] tracking-[-0.011em] text-ink-70">All day</span>
      </button>

      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${FIELD} tabular-nums`}
            />
          </Field>
          <Field label="Ends">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={`${FIELD} tabular-nums`}
            />
          </Field>
        </div>
      )}

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Optional"
          className={`${FIELD} h-auto resize-none py-3 leading-[1.55]`}
        />
      </Field>

      {problem && <p className="text-[13.5px] text-blue">{problem}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Action type="submit" className="flex-1">
          {event ? "Save changes" : "Add event"}
        </Action>
        {event ? (
          <Action
            tone="danger"
            onClick={() => {
              onDelete(event.id);
              onClose();
            }}
          >
            Delete
          </Action>
        ) : (
          <Action tone="quiet" onClick={onClose}>
            Cancel
          </Action>
        )}
      </div>
    </form>
  );
}
