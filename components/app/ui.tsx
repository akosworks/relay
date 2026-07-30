"use client";

import Link from "next/link";
import { AnimatePresence, motion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import type { EntityType, SourceType } from "@/lib/memory/types";
import { EASE } from "@/lib/motion";

/**
 * The small shared vocabulary the memory surfaces are built from.
 *
 * Same palette, same hairlines, same pill geometry as the marketing site — a
 * memory chip is the outline button at a smaller size, not a new component
 * language. Everything the five pages are made of lives here, which is what
 * stops the dashboard and the calendar drifting into two different products.
 */

export const TYPE_LABEL: Record<EntityType, string> = {
  decision: "Decision",
  project: "Project",
  person: "Person",
  meeting: "Meeting",
  task: "Task",
  customer: "Customer",
  procedure: "Procedure",
  issue: "Issue",
  feature: "Feature",
  document: "Document",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  "slack.message": "message",
  "slack.member": "directory",
  "github.pull_request": "pull request",
  "github.issue": "issue",
  "github.commit": "commit",
  "github.repository": "repository",
  "notion.page": "page",
  "gdocs.document": "document",
  "gdrive.file": "file",
  "gmail.thread": "email",
};

export function sourceLabel(type: SourceType): string {
  return SOURCE_LABEL[type] ?? type;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** Which calendar day a moment falls on, where the reader is sitting. */
function dayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

/**
 * How long ago, or how long until.
 *
 * Counted in calendar days, not in elapsed time. Something due at midnight this
 * morning is due today all day, and measuring the sixteen hours since would
 * round it to "yesterday" — which is not a rounding error, it is the wrong
 * answer to the only question the label exists to answer. A date with no time
 * on it is read as a local day for the same reason: `2026-07-29` means that
 * Wednesday where the user is, not midnight UTC.
 */
export function relativeDate(iso: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const then = new Date(dateOnly ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(then.getTime())) return iso;

  const days = dayIndex(new Date()) - dayIndex(then);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days === -1) return "tomorrow";

  if (days > 0) {
    if (days < 30) return `${plural(days, "day")} ago`;
    if (days < 365) return `${plural(Math.round(days / 30), "month")} ago`;
    return `${plural(Math.round(days / 365), "year")} ago`;
  }

  const ahead = -days;
  if (ahead < 14) return `in ${plural(ahead, "day")}`;
  if (ahead < 60) return `in ${plural(Math.round(ahead / 7), "week")}`;
  if (ahead < 365) return `in ${plural(Math.round(ahead / 30), "month")}`;
  return `in ${plural(Math.round(ahead / 365), "year")}`;
}

/** Type marker on a memory. Quiet: the title is what should be read. */
export function TypeTag({ type }: { type: EntityType }) {
  return (
    <span className="shrink-0 text-[11px] uppercase tracking-[0.09em] text-ink-45">
      {TYPE_LABEL[type]}
    </span>
  );
}

/**
 * Confidence as four ticks rather than a percentage: the number is an estimate
 * and showing two decimal places would claim more precision than exists.
 */
export function Confidence({ value, className = "" }: { value: number; className?: string }) {
  const filled = Math.max(1, Math.min(4, Math.round(value * 4)));
  return (
    <span
      className={`inline-flex items-center gap-[3px] ${className}`}
      title={`Confidence ${Math.round(value * 100)}%`}
      aria-label={`Confidence ${Math.round(value * 100)} percent`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`block h-[9px] w-[2px] rounded-full ${i < filled ? "bg-ink-45" : "bg-ink-25/60"}`}
        />
      ))}
    </span>
  );
}

/** Inline citation marker. Reads as a footnote, behaves as a button. */
export function CiteMark({
  index,
  onSelect,
  active = false,
}: {
  index: number;
  onSelect?: (index: number) => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(index)}
      className={`mx-[2px] inline-flex h-[17px] min-w-[17px] translate-y-[-2px] items-center justify-center rounded-[5px] px-[4px] align-middle text-[10.5px] font-medium tabular-nums transition-colors duration-300 ${
        active ? "bg-blue text-paper" : "bg-ink/[0.055] text-ink-70 hover:bg-blue hover:text-paper"
      }`}
      aria-label={`Evidence ${index}`}
    >
      {index}
    </button>
  );
}

export function Pill({
  children,
  onClick,
  href,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cls = `inline-flex items-center gap-2 rounded-full border border-rule px-4 py-2 text-[13.5px] tracking-[-0.01em] text-ink-70 transition-colors duration-400 hover:border-ink hover:text-ink ${className}`;
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function StatusDot({ status }: { status: "connected" | "disconnected" | "syncing" }) {
  const tone =
    status === "connected" ? "bg-blue" : status === "syncing" ? "bg-ink-45" : "bg-ink-25";
  return (
    <span className="relative flex h-[7px] w-[7px] items-center justify-center">
      {status === "syncing" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink-45 opacity-60" />
      )}
      <span className={`relative block h-[7px] w-[7px] rounded-full ${tone}`} />
    </span>
  );
}

/**
 * Whether a source is wired up, at the size of a full stop.
 *
 * A ring that is empty, filled, or turning. The three states are the three
 * things that can be true of a connection, and none of them needs a word next
 * to it: empty reads as "not yet", the filled centre reads as live, and the arc
 * turning reads as working. The halo on a live connection is the only place in
 * the product where colour is used decoratively, and it is four percent of one.
 */
export function Connection({
  status,
  size = 26,
}: {
  status: "connected" | "disconnected" | "syncing";
  size?: number;
}) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={`absolute inset-0 rounded-full border transition-colors duration-500 ${
          status === "connected" ? "border-blue/35" : "border-rule"
        }`}
      />

      {status === "connected" && (
        <>
          <span className="absolute inset-0 rounded-full bg-blue/[0.06]" />
          <motion.span
            className="block h-[7px] w-[7px] rounded-full bg-blue"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE.out }}
          />
        </>
      )}

      {status === "disconnected" && (
        <span className="block h-[7px] w-[7px] rounded-full border border-ink-25" />
      )}

      {status === "syncing" && (
        <motion.svg
          width={size}
          height={size}
          viewBox="0 0 26 26"
          fill="none"
          className="absolute inset-0 text-ink-45"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        >
          <path
            d="M13 1.6a11.4 11.4 0 0 1 11.4 11.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </motion.svg>
      )}
    </span>
  );
}

// ------------------------------------------------------------------- layout

/** The heading above a group. Quiet enough that the content is what is read. */
export function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[11.5px] uppercase tracking-[0.1em] text-ink-25 ${className}`}>
      {children}
    </h2>
  );
}

/** The page's own title block. Every page opens the same way. */
export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.85, ease: EASE.out }}
      className="pb-12 pt-16 sm:pt-20"
    >
      {eyebrow && <Label className="mb-4">{eyebrow}</Label>}
      <h1 className="display text-[clamp(1.9rem,3.6vw,2.6rem)]">{title}</h1>
      {children && (
        <div className="mt-4 max-w-[58ch] text-[16px] leading-[1.6] tracking-[-0.014em] text-ink-70">
          {children}
        </div>
      )}
    </motion.header>
  );
}

/**
 * The surface everything sits on: a hairline, a soft shadow and a lot of room.
 * `interactive` adds the lift — only for cards that actually do something, so
 * the hover state stays a promise rather than decoration.
 */
export function Panel({
  children,
  className = "",
  interactive = false,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.75, delay, ease: EASE.out }}
      className={`rounded-card border border-rule bg-paper/70 shadow-soft backdrop-blur-[2px] transition-[box-shadow,border-color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        interactive ? "hover:-translate-y-[3px] hover:border-ink-25 hover:shadow-lift" : ""
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * What a section says when there is nothing in it.
 *
 * This gets used a great deal on a first run, and that is the point: an empty
 * Relay should look deliberately empty and tell you what would fill it, not
 * pad itself out with examples that were never true.
 */
export function Empty({
  line,
  action,
  href,
}: {
  line: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="py-2">
      <p className="max-w-[46ch] text-[14.5px] leading-[1.6] tracking-[-0.011em] text-ink-45">
        {line}
      </p>
      {action && href && (
        <Link
          href={href}
          className="mt-3 inline-block text-[13.5px] tracking-[-0.012em] text-ink-70 transition-colors duration-400 hover:text-blue"
        >
          {action} →
        </Link>
      )}
    </div>
  );
}

// --------------------------------------------------------------------- forms

/**
 * The one field style. Everything the user types into looks like this, at the
 * one size, so a form never reads as a different product than the page holding it.
 */
export const FIELD =
  "h-[42px] w-full rounded-xl border border-rule bg-paper px-3.5 text-[14.5px] tracking-[-0.011em] text-ink outline-none transition-colors duration-400 placeholder:text-ink-25 hover:border-ink-25 focus:border-blue";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[12px] tracking-[-0.002em] text-ink-45">{label}</span>
      {children}
    </label>
  );
}

/** A button that reads as the primary action, at form scale. */
export function Action({
  children,
  onClick,
  type = "button",
  tone = "solid",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "solid" | "outline" | "quiet" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const skin = {
    solid: "bg-ink text-paper hover:bg-blue",
    outline: "border border-rule text-ink hover:border-ink",
    quiet: "text-ink-45 hover:text-ink",
    danger: "text-ink-45 hover:text-blue",
  }[tone];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-[42px] rounded-full px-5 text-[14px] font-medium tracking-[-0.012em] transition-colors duration-400 disabled:opacity-30 ${skin} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Priority, as weight rather than colour.
 *
 * Three filled bars for high, two for medium, one for low — so it can be read
 * without knowing a colour code, and so a list of low-priority tasks does not
 * turn the page into a traffic light. Only the top level gets any colour at all.
 */
export function PriorityMark({ level }: { level: "high" | "medium" | "low" }) {
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1;
  return (
    <span
      className="inline-flex shrink-0 items-end gap-[2px]"
      title={`${level} priority`}
      aria-label={`${level} priority`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`block w-[2px] rounded-full ${
            i < filled ? (level === "high" ? "bg-blue" : "bg-ink-45") : "bg-ink-25/50"
          }`}
          style={{ height: 4 + i * 3 }}
        />
      ))}
    </span>
  );
}

/**
 * A centred sheet for the one flow that needs a form: making an event.
 *
 * The same geometry and the same entrance as the Ask overlay, because they are
 * the same gesture — something coming forward over the workspace — and two
 * different modal languages in one product is one too many.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE.soft }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-ink/[0.14] backdrop-blur-[3px]"
          />
          <div className="pointer-events-none fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto px-4 py-[8vh]">
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, y: -12, scale: 0.975 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              transition={{ duration: 0.32, ease: EASE.out }}
              className="pointer-events-auto w-full max-w-[460px] rounded-[26px] border border-rule bg-paper p-6 shadow-lift sm:p-7"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-[16.5px] font-medium tracking-[-0.022em] text-ink">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-25 transition-colors duration-300 hover:text-ink"
                >
                  ✕
                </button>
              </div>
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ progress

/**
 * A spring that cannot show the wrong number.
 *
 * Every animated figure on these pages is derived from real data, which means the
 * animation is a nicety and the value is not. Browsers stop running animation
 * frames in a background tab, so a spring told to travel from 3 to 4 while the
 * tab is hidden would sit at 3 until the user came back — quietly reporting a
 * stale figure. So when the page is not being looked at, the value jumps.
 */
function useAnimatedNumber(value: number, stiffness = 140): MotionValue<number> {
  const spring = useSpring(value, { stiffness, damping: 20, mass: 0.5 });
  const target = useRef(value);

  useEffect(() => {
    target.current = value;
    if (document.visibilityState === "hidden") spring.jump(value);
    else spring.set(value);
  }, [spring, value]);

  // And if it is looked away from mid-flight, it finishes immediately rather
  // than freezing part-way there.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") spring.jump(target.current);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [spring]);

  return spring;
}

/**
 * Completion as a ring.
 *
 * The stroke is drawn by animating `pathLength`, so the arc travels round
 * whenever the number changes — the reason to use a ring at all is that
 * finishing something makes it move.
 */
export function Ring({
  value,
  size = 128,
  stroke = 3,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const pathLength = useAnimatedNumber(Math.max(0, Math.min(1, value)), 90);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-rule)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-blue)"
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ pathLength }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
    </div>
  );
}

/**
 * A number that counts to its new value rather than being replaced by it.
 *
 * Crossfading the old figure out and the new one in was the obvious way to do
 * this and the wrong one: it needs two elements alive at once, so for the length
 * of the transition the panel says both "3" and "4", and if the tab is in the
 * background when the value changes it can say both indefinitely. A spring on
 * the value itself has nothing to leave, cannot desynchronise, and reads better —
 * finishing a task makes the count travel.
 */
export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const spring = useAnimatedNumber(value);
  const text = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  return (
    <motion.span className="tabular-nums" aria-label={`${value}${suffix}`}>
      {text}
    </motion.span>
  );
}

/** Completion as a rule. Used where a ring would be too loud for one number. */
export function Bar({ value, className = "" }: { value: number; className?: string }) {
  // scaleX rather than width: the browser can composite it, so the bar cannot
  // make a list of tasks janky while it grows.
  const scaleX = useAnimatedNumber(Math.max(0, Math.min(1, value)), 110);

  return (
    <div className={`h-[3px] w-full overflow-hidden rounded-full bg-rule ${className}`}>
      <motion.div
        className="h-full w-full origin-left rounded-full bg-blue"
        style={{ scaleX }}
      />
    </div>
  );
}

/**
 * A line that is not here yet.
 *
 * Sized like the content it stands in for, so nothing jumps when the data
 * lands — the panel is already the right height before it has anything in it.
 */
export function Shimmer({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  // Uneven widths: three rules of identical length read as a graphic, not as text.
  const widths = ["78%", "92%", "64%", "85%", "71%"];
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="shimmer h-[9px] rounded-full"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

/** One number and what it counts. The dashboard's unit of measure. */
export function Stat({
  value,
  label,
  tone = "ink",
}: {
  value: React.ReactNode;
  label: string;
  tone?: "ink" | "quiet";
}) {
  return (
    <div>
      <p
        className={`text-[26px] font-medium tabular-nums leading-none tracking-[-0.032em] ${
          tone === "quiet" ? "text-ink-45" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-[12.5px] tracking-[-0.005em] text-ink-45">{label}</p>
    </div>
  );
}
