"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatAnswer } from "@/lib/chat/types";
import { askQuestion } from "@/lib/client/api";
import { Logo } from "@/components/Logo";
import type { MemoryOverview } from "@/lib/memory/overview";
import { EASE } from "@/lib/motion";
import { Answer } from "./Answer";
import { useWorkspace } from "./WorkspaceProvider";

/**
 * The conversation, independent of where it is shown.
 *
 * Asking Relay is one behaviour with two shapes: inline on home, where the
 * question is the point of the page, and over the top from anywhere else, where
 * it must not cost you your place. Keeping the thread, the composer and the
 * waiting state here means those two are the same conversation rendered
 * differently — not two implementations that drift.
 */

export type Exchange = {
  id: number;
  question: string;
  answer: ChatAnswer | null;
  error?: string;
};

export function useConversation() {
  const { refreshMemory } = useWorkspace();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
                { role: "agent" as const, content: exchange.answer.blocks[0]?.text ?? "" },
              ]
            : [],
        );
        const answer = await askQuestion(trimmed, history);
        setExchanges((prev) => prev.map((e) => (e.id === id ? { ...e, answer } : e)));
        refreshMemory();
      } catch (error) {
        setExchanges((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, error: error instanceof Error ? error.message : "Something went wrong." }
              : e,
          ),
        );
      } finally {
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [exchanges, pending, refreshMemory],
  );

  const reset = useCallback(() => {
    setExchanges([]);
    setDraft("");
  }, []);

  return { exchanges, draft, setDraft, pending, ask, reset, inputRef };
}

/** Questions this memory can genuinely be asked, one per kind of thing it holds. */
export function openersFrom(overview: MemoryOverview | null): string[] {
  if (!overview) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (question: string) => {
    if (out.length < 3 && !seen.has(question)) {
      out.push(question);
      seen.add(question);
    }
  };

  const byType = new Map<string, MemoryOverview["recent"][number]>();
  for (const memory of overview.recent) {
    if (memory.confidence < 0.7) continue;
    if (!byType.has(memory.type)) byType.set(memory.type, memory);
  }

  const project = byType.get("project");
  const decision = byType.get("decision");
  const procedure = byType.get("procedure");
  const customer = byType.get("customer");
  const person = byType.get("person");
  const feature = byType.get("feature") ?? byType.get("issue");

  if (project) add(`What is blocking ${project.title}?`);
  if (decision) add(`Why did we decide to ${decision.title.toLowerCase()}?`);
  if (procedure) add(`Explain ${procedure.title.toLowerCase()}.`);
  // "Who owns Fix cold start crash on Android 15?" is not a question anybody
  // asks. Ownership questions only read as questions about short names.
  if (feature && feature.title.split(/\s+/).length <= 4) add(`Who owns ${feature.title}?`);
  if (customer) add(`What does ${customer.title} need from us?`);
  if (person) add(`What has ${person.title.split(" ")[0]} been working on?`);
  return out;
}

/** The thread. Question, then what memory made of it, in the order asked. */
export function Thread({
  exchanges,
  onAsk,
  onOpenEntity,
  className = "",
}: {
  exchanges: Exchange[];
  onAsk: (question: string) => void;
  onOpenEntity: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {exchanges.map((exchange, i) => (
        <motion.article
          key={exchange.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.out }}
        >
          <p className="text-[14px] leading-[1.5] tracking-[-0.011em] text-ink-45">
            {exchange.question}
          </p>
          <div className="mt-4">
            {exchange.answer ? (
              <Answer
                answer={exchange.answer}
                latest={i === exchanges.length - 1}
                onAsk={onAsk}
                onOpenEntity={onOpenEntity}
              />
            ) : exchange.error ? (
              <p className="text-[15.5px] tracking-[-0.012em] text-ink-45">{exchange.error}</p>
            ) : (
              <Thinking />
            )}
          </div>
        </motion.article>
      ))}
    </div>
  );
}

/** Three questions the current memory can actually answer. */
export function Openers({
  questions,
  onAsk,
}: {
  questions: string[];
  onAsk: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      {questions.map((question, i) => (
        <motion.button
          key={question}
          type="button"
          onClick={() => onAsk(question)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 + i * 0.06, ease: EASE.out }}
          className="-mx-2 rounded-lg px-2 py-1.5 text-left text-[14.5px] tracking-[-0.012em] text-ink-70 transition-colors duration-300 hover:bg-ink/[0.03] hover:text-ink"
        >
          {question}
        </motion.button>
      ))}
    </div>
  );
}

/**
 * The one input in the product.
 *
 * Grows with the question rather than scrolling it out of sight. Enter sends;
 * shift and enter is a new line, which is the convention every writing surface
 * shares.
 */
export function Composer({
  ref,
  value,
  onChange,
  onSubmit,
  pending,
  autoFocus = false,
  placeholder = "Ask about a decision, a project, a person…",
}: {
  ref?: React.Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative"
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        rows={1}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="Ask Relay about your company"
        className="block w-full resize-none rounded-[20px] bg-transparent py-3 pl-4 pr-[52px] text-[16px] leading-[1.5] tracking-[-0.013em] text-ink outline-none placeholder:text-ink-25"
      />
      <button
        type="submit"
        disabled={pending || value.trim().length === 0}
        aria-label="Ask"
        className="absolute bottom-[6px] right-[6px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink text-paper transition-all duration-400 hover:bg-blue disabled:opacity-20"
      >
        <AskArrow size={14} />
      </button>
    </form>
  );
}

export function AskArrow({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The phases retrieval actually goes through, named honestly. */
const PHASES = ["Searching memory", "Following connections", "Checking the sources"];

/**
 * The pause while memory is searched. The mark pulses at the weight of a
 * hairline, so the wait looks like Relay rather than like a spinner bolted on.
 */
export function Thinking() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((p) => Math.min(p + 1, PHASES.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3" role="status">
      <motion.div
        className="text-ink-25"
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Logo size={18} />
      </motion.div>
      <div className="relative h-[21px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: EASE.out }}
            className="block text-[14.5px] tracking-[-0.012em] text-ink-45"
          >
            {PHASES[phase]}…
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
