"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ChatAnswer, Citation } from "@/lib/chat/types";
import { EASE } from "@/lib/motion";
import { CiteMark, Confidence, formatDate, Pill, sourceLabel, TypeTag } from "./ui";

/**
 * An answer, and everything behind it.
 *
 * The claim comes first and the working is one click away: evidence is
 * collapsed by default so the conversation stays readable, but a citation
 * number opens it and highlights the exact source that carried the claim.
 * Nothing here is decoration — if a sentence had no evidence the agent would
 * not have written it.
 */

function EvidenceCard({ citation, active }: { citation: Citation; active: boolean }) {
  return (
    <motion.li
      layout
      id={`evidence-${citation.index}`}
      className={`rounded-2xl border px-5 py-4 transition-colors duration-500 ${
        active ? "border-ink" : "border-rule"
      }`}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] bg-ink/[0.055] px-1 text-[10.5px] font-medium tabular-nums text-ink-70">
          {citation.index}
        </span>
        <span className="text-[13px] font-medium tracking-[-0.01em] text-ink">
          {citation.integrationName}
        </span>
        <span className="text-[12.5px] text-ink-45">{sourceLabel(citation.sourceType)}</span>
        <span className="ml-auto shrink-0 text-[12.5px] tabular-nums text-ink-45">
          {formatDate(citation.occurredAt)}
        </span>
      </div>

      <p className="mt-2 text-[13.5px] tracking-[-0.01em] text-ink-45">
        {citation.title}
        {/* Slack titles already carry the speaker; don't say it twice. */}
        {citation.author && !citation.title.includes(citation.author)
          ? ` · ${citation.author}`
          : ""}
      </p>

      <p className="mt-2.5 text-[14.5px] leading-[1.6] tracking-[-0.011em] text-ink-70">
        “{citation.excerpt}”
      </p>

      {citation.url && (
        <a
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-400 hover:text-blue"
        >
          Open in {citation.integrationName} ↗
        </a>
      )}
    </motion.li>
  );
}

export function Answer({
  answer,
  onAsk,
  onOpenEntity,
}: {
  answer: ChatAnswer;
  onAsk: (question: string) => void;
  onOpenEntity: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  const reveal = (index: number) => {
    setOpen(true);
    setActive(index);
    // Let the list mount before moving to it.
    window.setTimeout(() => {
      document
        .getElementById(`evidence-${index}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  };

  const grounded = answer.citations.length > 0;

  return (
    <div className="pb-2">
      <div className="space-y-3">
        {answer.blocks.map((block, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: i * 0.06, ease: EASE.out }}
            className={block.kind === "bullet" ? "flex gap-3 pl-1" : ""}
          >
            {block.kind === "bullet" && (
              <span className="mt-[11px] block h-[3px] w-[3px] shrink-0 rounded-full bg-ink-25" />
            )}
            <p
              className={`text-[16.5px] leading-[1.62] tracking-[-0.014em] ${
                block.kind === "bullet" ? "text-ink-70" : "text-ink"
              }`}
            >
              {block.text}
              {block.citations.map((index) => (
                <CiteMark
                  key={index}
                  index={index}
                  active={active === index}
                  onSelect={reveal}
                />
              ))}
            </p>
          </motion.div>
        ))}
      </div>

      {/* How sure, and on what. */}
      {grounded && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] tracking-[-0.01em] text-ink-45">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 transition-colors duration-400 hover:text-ink"
          >
            <span className={`transition-transform duration-500 ${open ? "rotate-90" : ""}`}>›</span>
            {answer.citations.length} source{answer.citations.length > 1 ? "s" : ""}
          </button>
          <span className="inline-flex items-center gap-2">
            <Confidence value={answer.confidence} />
            {Math.round(answer.confidence * 100)}% confidence
          </span>
          <span>
            {answer.memories.length} memor{answer.memories.length === 1 ? "y" : "ies"} used
          </span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.55, ease: EASE.out }}
            className="mt-4 space-y-2.5 overflow-hidden"
          >
            {answer.citations.map((citation) => (
              <EvidenceCard
                key={citation.index}
                citation={citation}
                active={active === citation.index}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {answer.memories.length > 0 && (
        <div className="mt-5">
          <p className="text-[12px] uppercase tracking-[0.09em] text-ink-25">Memory used</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {answer.memories.slice(0, 8).map((memory) => (
              <button
                key={memory.id}
                type="button"
                onClick={() => onOpenEntity(memory.id)}
                title={memory.reasons.join(" · ")}
                className="group inline-flex max-w-full items-center gap-2.5 rounded-full border border-rule px-3.5 py-[7px] text-left transition-colors duration-400 hover:border-ink"
              >
                <TypeTag type={memory.type} />
                <span className="truncate text-[13.5px] tracking-[-0.012em] text-ink-70 group-hover:text-ink">
                  {memory.title}
                </span>
                <Confidence value={memory.confidence} />
              </button>
            ))}
          </div>
        </div>
      )}

      {answer.followUps.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {answer.followUps.map((question) => (
            <Pill key={question} onClick={() => onAsk(question)}>
              {question}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
