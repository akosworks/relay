"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import type { Priority, TaskInput } from "@/lib/workspace/types";
import { EASE } from "@/lib/motion";

/**
 * Adding a task.
 *
 * One field, always ready, focus kept after submitting so three tasks is three
 * lines and two keystrokes rather than three round trips through a form. A date
 * and a priority are optional and hidden until asked for: most tasks never get
 * either, and a composer that demands them is a composer people stop opening.
 */

const LEVELS: Priority[] = ["low", "medium", "high"];

export function TaskComposer({
  today,
  onCreate,
}: {
  today: string;
  onCreate: (input: TaskInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    // Cleared before the request, not after: the field should be ready for the
    // next thought immediately, and the store has already applied this one.
    setTitle("");
    setDueDate("");
    setPriority(null);
    setDetailsOpen(false);
    input.current?.focus();

    await onCreate({
      title: trimmed,
      dueDate: dueDate || null,
      priority,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative">
        <input
          ref={input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTitle("");
          }}
          placeholder="Add a task…"
          aria-label="Add a task"
          className="h-[48px] w-full rounded-2xl border border-rule bg-paper pl-4 pr-[132px] text-[15px] tracking-[-0.012em] text-ink outline-none transition-colors duration-400 placeholder:text-ink-25 hover:border-ink-25 focus:border-blue"
        />

        <div className="absolute right-[6px] top-[6px] flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className={`h-[36px] rounded-xl px-3 text-[13px] tracking-[-0.008em] transition-colors duration-300 ${
              dueDate || priority
                ? "text-ink"
                : "text-ink-45 hover:text-ink"
            }`}
          >
            {dueDate || priority ? "Details ·" : "Details"}
            {dueDate && <span className="ml-1 tabular-nums">{dueDate.slice(5)}</span>}
            {priority && <span className="ml-1">{priority}</span>}
          </button>

          <button
            type="submit"
            disabled={title.trim().length === 0}
            aria-label="Add task"
            className="flex h-[36px] w-[36px] items-center justify-center rounded-xl bg-ink text-paper transition-all duration-400 hover:bg-blue disabled:opacity-20"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M7 2.5v9M2.5 7h9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {detailsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.34, ease: EASE.out }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
                className="h-[36px] rounded-xl border border-rule bg-paper px-3 text-[13px] tabular-nums text-ink-70 outline-none transition-colors duration-300 hover:border-ink-25 focus:border-blue"
              />
              <button
                type="button"
                onClick={() => setDueDate(today)}
                className="h-[36px] rounded-xl border border-rule px-3 text-[13px] text-ink-45 transition-colors duration-300 hover:border-ink-25 hover:text-ink"
              >
                Today
              </button>

              <span className="mx-1 h-4 w-px bg-rule" />

              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPriority(priority === level ? null : level)}
                  aria-pressed={priority === level}
                  className={`h-[36px] rounded-xl border px-3 text-[13px] tracking-[-0.008em] transition-colors duration-300 ${
                    priority === level
                      ? "border-ink text-ink"
                      : "border-rule text-ink-45 hover:border-ink-25"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
