"use client";

import type { EntityType, SourceType } from "@/lib/memory/types";

/**
 * The small shared vocabulary the memory surfaces are built from.
 *
 * Same palette, same hairlines, same pill geometry as the marketing site — a
 * memory chip is the outline button at a smaller size, not a new component
 * language.
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
  "notion.page": "page",
  "gdocs.document": "document",
  "gdrive.file": "file",
  "gmail.thread": "email",
  "jira.issue": "ticket",
  "linear.issue": "issue",
  "transcript.meeting": "transcript",
};

export function sourceLabel(type: SourceType): string {
  return SOURCE_LABEL[type] ?? type;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
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
