"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ChatAnswer, Citation } from "@/lib/chat/types";
import { EASE } from "@/lib/motion";
import { CiteMark, Confidence, formatDate, Label, sourceLabel, TypeTag } from "./ui";

/**
 * An answer, and everything behind it.
 *
 * The claim is the page; the working is one click away. Evidence, the memories
 * that carried the claim and the sources they came from all live behind a single
 * quiet line, because a coworker tells you the answer and then offers to show
 * you where it came from — they do not hand you the folder first. Nothing here
 * is decoration: if a sentence had no evidence the agent would not have written
 * it, and if it had none at all it says so instead.
 */

function EvidenceCard({ citation, active }: { citation: Citation; active: boolean }) {
  return (
    <li
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
    </li>
  );
}

/** What the agent says when memory cannot carry the question. Never a guess. */
function Unanswered({ answer }: { answer: ChatAnswer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE.out }}
    >
      <p className="text-[17px] leading-[1.6] tracking-[-0.015em] text-ink">
        {answer.blocks[0]?.text}
      </p>
      {answer.blocks[1] && (
        <p className="mt-3 max-w-[54ch] text-[15.5px] leading-[1.62] tracking-[-0.012em] text-ink-45">
          {answer.blocks[1].text}
        </p>
      )}
      <Link
        href="/integrations"
        className="mt-5 inline-flex h-[42px] items-center rounded-full border border-rule px-5 text-[14px] font-medium tracking-[-0.012em] text-ink transition-colors duration-500 hover:border-ink"
      >
        Connect a source
      </Link>
    </motion.div>
  );
}

export function Answer({
  answer,
  latest,
  onAsk,
  onOpenEntity,
}: {
  answer: ChatAnswer;
  /** Follow-ups belong to the live end of the thread, not to every turn in it. */
  latest: boolean;
  onAsk: (question: string) => void;
  onOpenEntity: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  if (!answer.grounded) return <Unanswered answer={answer} />;

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

  return (
    <div>
      <div className="space-y-3.5">
        {answer.blocks.map((block, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: EASE.out }}
            className={block.kind === "bullet" ? "flex gap-3.5 pl-0.5" : ""}
          >
            {block.kind === "bullet" && (
              <span className="mt-[12px] block h-[3px] w-[3px] shrink-0 rounded-full bg-ink-25" />
            )}
            <p
              className={`text-[17px] leading-[1.64] tracking-[-0.015em] ${
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

      {/* One line for everything behind the answer. Closed, this is the only
          trace of the machinery; open, it is the whole audit trail. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: EASE.out }}
        className="mt-7"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group inline-flex items-center gap-3 text-[13px] tracking-[-0.01em] text-ink-45 transition-colors duration-400 hover:text-ink"
        >
          <span
            className={`inline-block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ›
          </span>
          {answer.citations.length} source{answer.citations.length === 1 ? "" : "s"}
          <span className="text-ink-25">·</span>
          {answer.memories.length} memor{answer.memories.length === 1 ? "y" : "ies"}
          <span className="text-ink-25">·</span>
          <span className="inline-flex items-center gap-2">
            <Confidence value={answer.confidence} />
            {Math.round(answer.confidence * 100)}%
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.55, ease: EASE.out }}
              className="overflow-hidden"
            >
              <ul className="mt-5 space-y-2.5">
                {answer.citations.map((citation) => (
                  <EvidenceCard
                    key={citation.index}
                    citation={citation}
                    active={active === citation.index}
                  />
                ))}
              </ul>

              {answer.memories.length > 0 && (
                <div className="mt-7">
                  <Label>Memory used</Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {answer.memories.map((memory) => (
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {latest && answer.followUps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE.out }}
          className="mt-8 flex flex-col items-start gap-2.5"
        >
          {answer.followUps.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => onAsk(question)}
              className="text-left text-[15px] tracking-[-0.013em] text-ink-45 transition-colors duration-400 hover:text-blue"
            >
              {question}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
