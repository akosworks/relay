"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { askQuestion } from "@/lib/client/api";
import type { ChatAnswer } from "@/lib/chat/types";
import { EASE } from "@/lib/motion";
import { Answer } from "./Answer";

/**
 * The product, as a page.
 *
 * A single column, an input at the bottom, and nothing else competing for
 * attention. Panels and evidence only appear once there is something to
 * explain — before the first question the page is a prompt and a cursor.
 */

const OPENERS = [
  "Why was our launch delayed?",
  "Who owns authentication?",
  "Explain our onboarding process.",
  "Summarize everything about Project Atlas.",
  "What changed since last month's planning meeting?",
];

type Exchange = {
  id: number;
  question: string;
  answer: ChatAnswer | null;
  error?: string;
};

/** Lets the surrounding page put a question to the agent, e.g. from the drawer. */
export type ChatHandle = { ask: (question: string) => void };

export function Chat({
  ref,
  onLearned,
  onOpenEntity,
}: {
  ref?: React.Ref<ChatHandle>;
  onLearned?: () => void;
  onOpenEntity: (id: string) => void;
}) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      const id = Date.now();
      setExchanges((prev) => [...prev, { id, question: trimmed, answer: null }]);
      setDraft("");
      setPending(true);

      try {
        const history = exchanges.flatMap((exchange) =>
          exchange.answer
            ? [
                { role: "user" as const, content: exchange.question },
                {
                  role: "agent" as const,
                  content: exchange.answer.blocks[0]?.text ?? "",
                },
              ]
            : [],
        );
        const answer = await askQuestion(trimmed, history);
        setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)));
        onLearned?.();
      } catch (error) {
        setExchanges((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  error: error instanceof Error ? error.message : "Something went wrong.",
                }
              : e,
          ),
        );
      } finally {
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [exchanges, onLearned, pending],
  );

  useImperativeHandle(ref, () => ({ ask }), [ask]);

  // Follow the conversation down as it grows, never yank it mid-read.
  useEffect(() => {
    if (exchanges.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  const empty = exchanges.length === 0;

  return (
    <>
      <div
        className={`flex min-h-[calc(100svh-64px)] flex-col ${empty ? "justify-center" : ""}`}
      >
        {empty && (
          <motion.div
            key="opening"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE.out }}
            className="pb-[128px] pt-10"
          >
            <h1 className="display max-w-[16ch] text-[clamp(2rem,4.6vw,3.25rem)]">
              Ask anything the company knows.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[16.5px] leading-[1.6] tracking-[-0.014em] text-ink-70">
              Relay has been reading your connected tools and turning what it finds into
              memory — decisions, projects, people, and the reasons behind them. Every
              answer shows the sources it came from.
            </p>

            <div className="mt-9 flex flex-wrap gap-2">
              {OPENERS.map((question, i) => (
                <motion.button
                  key={question}
                  type="button"
                  onClick={() => ask(question)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: 0.15 + i * 0.06,
                    ease: EASE.out,
                  }}
                  className="rounded-full border border-rule px-4 py-2.5 text-[14px] tracking-[-0.012em] text-ink-70 transition-colors duration-400 hover:border-ink hover:text-ink"
                >
                  {question}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {!empty && (
          <div className="space-y-14 pb-[168px] pt-14">
            {exchanges.map((exchange) => (
              <article key={exchange.id} className="space-y-6">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: EASE.out }}
                  className="text-[21px] font-medium leading-[1.35] tracking-[-0.026em] text-ink"
                >
                  {exchange.question}
                </motion.h2>

                {exchange.answer ? (
                  <Answer
                    answer={exchange.answer}
                    onAsk={ask}
                    onOpenEntity={onOpenEntity}
                  />
                ) : exchange.error ? (
                  <p className="text-[15.5px] tracking-[-0.012em] text-ink-45">
                    {exchange.error}
                  </p>
                ) : (
                  <Thinking />
                )}
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer. Fixed, so the question is always one keystroke away. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div className="h-14 bg-gradient-to-t from-paper to-transparent" />
        <div className="bg-paper pb-7 pt-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="pointer-events-auto mx-auto flex max-w-[1240px] gap-3 px-6 sm:px-10"
          >
            <div className="relative flex-1 xl:max-w-[calc(100%-316px)]">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask Relay about your company…"
                aria-label="Ask Relay about your company"
                autoFocus
                className="h-[54px] w-full rounded-full border border-rule bg-paper pl-6 pr-[58px] text-[15.5px] tracking-[-0.012em] text-ink outline-none transition-colors duration-400 placeholder:text-ink-25 hover:border-ink-25 focus:border-blue"
              />
              <button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                aria-label="Ask"
                className="absolute right-[6px] top-[6px] flex h-[42px] w-[42px] items-center justify-center rounded-full bg-ink text-paper transition-all duration-400 hover:bg-blue disabled:opacity-25"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/** The pause while memory is searched. Three ticks, no spinner. */
function Thinking() {
  return (
    <div className="flex items-center gap-1.5" role="status" aria-label="Searching memory">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-[5px] w-[5px] rounded-full bg-ink-25"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
