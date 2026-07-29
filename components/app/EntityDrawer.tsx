"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { fetchEntity } from "@/lib/client/api";
import type { EntityDetail } from "@/lib/memory/types";
import { EASE } from "@/lib/motion";
import { Confidence, formatDate, sourceLabel, TYPE_LABEL } from "./ui";

/**
 * One memory, opened.
 *
 * This is where the knowledge graph becomes navigable: every relationship is a
 * link to another memory, so a user can walk from a decision to the person who
 * made it to the work it blocked without ever going back to search.
 */
export function EntityDrawer({
  entityId,
  onClose,
  onOpenEntity,
  onAsk,
}: {
  entityId: string | null;
  onClose: () => void;
  onOpenEntity: (id: string) => void;
  onAsk: (question: string) => void;
}) {
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [failed, setFailed] = useState(false);

  // Loading is derived rather than stored: the panel is loading exactly while
  // what it holds is not yet the memory that was asked for.
  const loaded = detail && detail.entity.id === entityId ? detail : null;
  const loading = Boolean(entityId) && !loaded && !failed;

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;

    fetchEntity(entityId)
      .then((result) => {
        if (cancelled) return;
        setDetail(result);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [entityId]);

  useEffect(() => {
    if (!entityId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entityId, onClose]);

  const entity = loaded?.entity;
  const attributes = Object.entries(entity?.attributes ?? {}).filter(
    ([, value]) => value !== null && value !== "" && !(Array.isArray(value) && value.length === 0),
  );

  return (
    <AnimatePresence>
      {entityId && (
        <>
          <motion.button
            key="scrim"
            type="button"
            aria-label="Close memory"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE.soft }}
            className="fixed inset-0 z-50 cursor-default bg-ink/[0.12]"
          />

          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.62, ease: EASE.out }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col bg-paper shadow-[-1px_0_0_0_var(--color-rule)]"
          >
            <header className="flex items-center justify-between px-7 pb-4 pt-6">
              <span className="text-[11px] uppercase tracking-[0.09em] text-ink-45">
                {entity ? TYPE_LABEL[entity.type] : "Memory"}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-45 transition-colors duration-400 hover:text-ink"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-7 pb-10">
              {loading && <p className="text-[14px] text-ink-45">Opening memory…</p>}
              {failed && !loaded && (
                <p className="text-[14px] text-ink-45">That memory could not be opened.</p>
              )}

              {loaded && entity && (
                <>
                  <h2 className="text-[24px] font-medium leading-[1.2] tracking-[-0.03em] text-ink">
                    {entity.title}
                  </h2>
                  <p className="mt-3 text-[15px] leading-[1.6] tracking-[-0.012em] text-ink-70">
                    {entity.summary}
                  </p>

                  <div className="mt-4 flex items-center gap-3 text-[13px] text-ink-45">
                    <Confidence value={entity.confidence} />
                    <span>{Math.round(entity.confidence * 100)}% confidence</span>
                    <span>·</span>
                    <span>
                      {entity.sources.length} source{entity.sources.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {attributes.length > 0 && (
                    <dl className="mt-7 space-y-2.5 border-t border-rule pt-6">
                      {attributes.map(([key, value]) => (
                        <div key={key} className="flex gap-4 text-[14px] tracking-[-0.011em]">
                          <dt className="w-[104px] shrink-0 text-ink-45">
                            {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                          </dt>
                          <dd className="flex-1 text-ink-70">
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {loaded.related.length > 0 && (
                    <section className="mt-8 border-t border-rule pt-6">
                      <h3 className="text-[12px] uppercase tracking-[0.09em] text-ink-25">
                        Connected memory
                      </h3>
                      <ul className="mt-3 space-y-1">
                        {loaded.related.map((relation, i) => (
                          <li key={`${relation.entity.id}-${relation.type}-${i}`}>
                            <button
                              type="button"
                              onClick={() => onOpenEntity(relation.entity.id)}
                              className="group -mx-3 flex w-[calc(100%+24px)] items-baseline gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-300 hover:bg-ink/[0.028]"
                            >
                              <span className="w-[92px] shrink-0 text-[12.5px] text-ink-45">
                                {relation.direction === "out"
                                  ? relation.type.replace(/_/g, " ")
                                  : `${relation.type.replace(/_/g, " ")} ←`}
                              </span>
                              <span className="flex-1 text-[14px] tracking-[-0.012em] text-ink-70 group-hover:text-ink">
                                {relation.entity.title}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {loaded.timeline.length > 0 && (
                    <section className="mt-8 border-t border-rule pt-6">
                      <h3 className="text-[12px] uppercase tracking-[0.09em] text-ink-25">
                        How this was learned
                      </h3>
                      <ol className="mt-4 space-y-4">
                        {loaded.timeline.map((item, i) => (
                          <li key={i} className="relative flex gap-4 pl-1">
                            <span className="mt-[7px] block h-[5px] w-[5px] shrink-0 rounded-full bg-ink-25" />
                            <div className="min-w-0">
                              <p className="text-[14px] tracking-[-0.012em] text-ink-70">
                                {item.label}
                              </p>
                              <p className="mt-0.5 text-[12.5px] tabular-nums text-ink-45">
                                {formatDate(item.at)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {loaded.evidence.length > 0 && (
                    <section className="mt-8 border-t border-rule pt-6">
                      <h3 className="text-[12px] uppercase tracking-[0.09em] text-ink-25">
                        Original sources
                      </h3>
                      <ul className="mt-3 space-y-2.5">
                        {loaded.evidence.map((event) => (
                          <li key={event.id} className="rounded-2xl border border-rule px-4 py-3.5">
                            <div className="flex items-baseline gap-2 text-[12.5px]">
                              <span className="font-medium text-ink">{event.integrationName}</span>
                              <span className="text-ink-45">{sourceLabel(event.sourceType)}</span>
                              <span className="ml-auto tabular-nums text-ink-45">
                                {formatDate(event.occurredAt)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[13px] text-ink-45">{event.title}</p>
                            <p className="mt-2 text-[14px] leading-[1.55] tracking-[-0.011em] text-ink-70">
                              {event.body.length > 260
                                ? `${event.body.slice(0, 260)}…`
                                : event.body}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <button
                    type="button"
                    onClick={() => onAsk(`Summarize everything about ${entity.title}.`)}
                    className="mt-8 h-[46px] w-full rounded-full border border-rule text-[14.5px] font-medium tracking-[-0.012em] text-ink transition-colors duration-500 hover:border-ink"
                  >
                    Ask about this
                  </button>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
