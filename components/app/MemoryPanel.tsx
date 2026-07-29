"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { MemoryOverview } from "@/lib/memory/overview";
import { EASE } from "@/lib/motion";
import { relativeDate, StatusDot, TYPE_LABEL } from "./ui";

/**
 * The context rail.
 *
 * Deliberately a summary and not a dashboard: what memory holds, what it
 * learned last, and where it is learning from. Enough to trust the answers,
 * not enough to distract from asking the next question.
 */
export function MemoryPanel({
  overview,
  onOpenEntity,
}: {
  overview: MemoryOverview | null;
  onOpenEntity: (id: string) => void;
}) {
  if (!overview) return null;

  const connected = overview.integrations.filter((i) => i.status !== "disconnected");
  const types = Object.entries(overview.entitiesByType).sort((a, b) => b[1] - a[1]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: EASE.out }}
      className="space-y-8"
    >
      <section>
        <h2 className="text-[12px] uppercase tracking-[0.09em] text-ink-25">Memory</h2>
        <p className="mt-3 text-[15px] leading-[1.55] tracking-[-0.012em] text-ink-70">
          <span className="tabular-nums text-ink">{overview.entities}</span> memories and{" "}
          <span className="tabular-nums text-ink">{overview.relationships}</span> links,
          extracted from{" "}
          <span className="tabular-nums text-ink">{overview.events}</span> events across{" "}
          {connected.length} source{connected.length === 1 ? "" : "s"}.
        </p>

        <ul className="mt-4 space-y-1.5">
          {types.slice(0, 6).map(([type, count]) => (
            <li key={type} className="flex items-baseline gap-3 text-[13.5px]">
              <span className="flex-1 text-ink-45">
                {TYPE_LABEL[type as keyof typeof TYPE_LABEL] ?? type}
              </span>
              <span className="tabular-nums text-ink-70">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-[0.09em] text-ink-25">Learned recently</h2>
        <ul className="mt-3 space-y-0.5">
          {overview.recent.slice(0, 5).map((memory) => (
            <li key={memory.id}>
              <button
                type="button"
                onClick={() => onOpenEntity(memory.id)}
                className="group -mx-2 w-[calc(100%+16px)] rounded-lg px-2 py-1.5 text-left transition-colors duration-300 hover:bg-ink/[0.028]"
              >
                <p className="truncate text-[13.5px] tracking-[-0.012em] text-ink-70 group-hover:text-ink">
                  {memory.title}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-45">
                  {TYPE_LABEL[memory.type]} · {relativeDate(memory.occurredAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-[0.09em] text-ink-25">Learning from</h2>
        <ul className="mt-3 space-y-1.5">
          {connected.map((integration) => (
            <li key={integration.id} className="flex items-center gap-2.5 text-[13.5px]">
              <StatusDot status={integration.status} />
              <span className="flex-1 text-ink-70">{integration.name}</span>
              <span className="tabular-nums text-ink-45">{integration.events}</span>
            </li>
          ))}
        </ul>
        <Link
          href="/integrations"
          className="mt-4 inline-block text-[13.5px] tracking-[-0.012em] text-ink-45 transition-colors duration-400 hover:text-blue"
        >
          Connect more sources →
        </Link>
      </section>
    </motion.div>
  );
}
