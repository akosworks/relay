"use client";

import { motion, Reorder, useDragControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Priority, Task, TaskInput } from "@/lib/workspace/types";
import { EASE } from "@/lib/motion";
import { PriorityMark, relativeDate } from "./ui";

/**
 * One task.
 *
 * Everything about it is editable in place: the title is a text field that only
 * looks like a heading, the meta line opens the two optional details, and the
 * handle on the left drags it. There is no edit mode and no detail page, because
 * a task is one line of text and opening a screen to change one line of text is
 * the sort of thing that stops people using a task list.
 */

const PRIORITY_ORDER: (Priority | null)[] = [null, "low", "medium", "high"];

export function TaskCheck({
  done,
  onToggle,
  label,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={`relative flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-300 ${
        done ? "border-blue bg-blue text-paper" : "border-ink-25 text-transparent hover:border-ink"
      }`}
    >
      {/* The tick draws itself rather than appearing. It happens a few dozen
          times a day, so it is worth three hundred milliseconds. */}
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <motion.path
          d="M2.5 6.4 4.7 8.6 9.5 3.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: done ? 1 : 0 }}
          transition={{ duration: 0.3, ease: EASE.out }}
        />
      </svg>

      {/* A ring that expands and fades on completion: the only celebration in
          the product, and it lasts half a second. */}
      {done && (
        <motion.span
          key="pulse"
          initial={{ opacity: 0.5, scale: 1 }}
          animate={{ opacity: 0, scale: 2.1 }}
          transition={{ duration: 0.55, ease: EASE.out }}
          className="pointer-events-none absolute inset-0 rounded-[7px] border border-blue"
        />
      )}
    </button>
  );
}

export function TaskRow({
  task,
  today,
  onToggle,
  onEdit,
  onRemove,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  onEdit: (patch: Partial<TaskInput>) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const [title, setTitle] = useState(task.title);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Keep in step when the task changes underneath — another surface may have
  // edited it — but never while the field has focus and unsaved keystrokes in it.
  useEffect(() => {
    if (document.activeElement !== input.current) setTitle(task.title);
  }, [task.title]);

  const commitTitle = () => {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
      return;
    }
    if (next !== task.title) onEdit({ title: next });
  };

  const overdue = !task.done && task.dueDate !== null && task.dueDate < today;
  const dueToday = !task.done && task.dueDate === today;

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.22, ease: EASE.out } }}
      transition={{ duration: 0.4, ease: EASE.out }}
      className="group relative"
    >
      <div className="flex items-start gap-3 py-3">
        {/* The handle only exists for the pointer; the list is reorderable from
            the keyboard through the buttons the row already has. */}
        <span
          onPointerDown={(e) => controls.start(e)}
          aria-hidden="true"
          className="mt-[3px] -ml-4 hidden w-4 cursor-grab touch-none select-none text-center text-[13px] leading-none text-ink-25 opacity-0 transition-opacity duration-300 group-hover:opacity-100 active:cursor-grabbing sm:block"
        >
          ⠿
        </span>

        <div className="mt-[1px]">
          <TaskCheck
            done={task.done}
            onToggle={onToggle}
            label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <input
            ref={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Committed here rather than by blurring and letting the blur
                // handler do it: return should save the edit even if focus never
                // actually leaves, which is the case on more platforms than you
                // would hope.
                commitTitle();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setTitle(task.title);
                e.currentTarget.blur();
              }
            }}
            aria-label="Task title"
            className={`w-full bg-transparent text-[15px] leading-[1.45] tracking-[-0.013em] outline-none transition-colors duration-500 ${
              task.done ? "text-ink-25 line-through" : "text-ink-70 focus:text-ink"
            }`}
          />

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {task.priority && <PriorityMark level={task.priority} />}

            {task.dueDate && (
              <span
                className={
                  overdue ? "text-blue" : dueToday ? "text-ink-70" : "tabular-nums text-ink-45"
                }
              >
                {overdue ? "overdue · " : ""}
                {relativeDate(task.dueDate)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="text-ink-25 opacity-0 transition-opacity duration-300 hover:text-ink-45 focus-visible:opacity-100 group-hover:opacity-100"
            >
              {task.dueDate || task.priority ? "Change" : "Add date or priority"}
            </button>

            <button
              type="button"
              onClick={onRemove}
              className="text-ink-25 opacity-0 transition-opacity duration-300 hover:text-blue focus-visible:opacity-100 group-hover:opacity-100"
            >
              Delete
            </button>
          </div>

          {detailsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.32, ease: EASE.out }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 pb-1 pt-3">
                <input
                  type="date"
                  value={task.dueDate ?? ""}
                  onChange={(e) => onEdit({ dueDate: e.target.value || null })}
                  aria-label="Due date"
                  className="h-[34px] rounded-lg border border-rule bg-paper px-2.5 text-[13px] tabular-nums text-ink-70 outline-none transition-colors duration-300 hover:border-ink-25 focus:border-blue"
                />

                {PRIORITY_ORDER.map((level) => (
                  <button
                    key={level ?? "none"}
                    type="button"
                    onClick={() => onEdit({ priority: level })}
                    aria-pressed={task.priority === level}
                    className={`h-[34px] rounded-lg border px-3 text-[13px] tracking-[-0.008em] transition-colors duration-300 ${
                      task.priority === level
                        ? "border-ink text-ink"
                        : "border-rule text-ink-45 hover:border-ink-25"
                    }`}
                  >
                    {level ?? "None"}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}
