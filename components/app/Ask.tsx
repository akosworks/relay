"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { askQuestion } from "@/lib/client/api";
import type { ChatAnswer } from "@/lib/chat/types";
import type { MemoryOverview } from "@/lib/memory/overview";
import { Logo } from "@/components/Logo";
import { EASE } from "@/lib/motion";
import { Answer } from "./Answer";
import { EntityDrawer } from "./EntityDrawer";
import { useWorkspace } from "./WorkspaceProvider";

/**
 * Asking Relay, from anywhere.
 *
 * Not a page. Asking a colleague a question does not involve going to a
 * different room, and it should not involve leaving whatever you were looking
 * at: the overlay opens over the workspace, answers, and gets out of the way.
 * Command-K from any screen, or the field on the dashboard, which is the same
 * thing wearing a different shape.
 *
 * Inside it there are four things and nothing else — the name, the
 * conversation, the input, and a single line offering to show the working.
 */

interface AskState {
  open: boolean;
  /** Opens the overlay, optionally with a question already asked. */
  openAsk: (question?: string) => void;
  closeAsk: () => void;
}

const AskContext = createContext<AskState | null>(null);

export function useAsk(): AskState {
  const value = useContext(AskContext);
  if (!value) throw new Error("useAsk must be used inside AskProvider.");
  return value;
}

type Exchange = {
  id: number;
  question: string;
  answer: ChatAnswer | null;
  error?: string;
};

/** Questions this memory can genuinely be asked, one per kind of thing it holds. */
function openersFrom(overview: MemoryOverview | null): string[] {
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

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const openAsk = useCallback((question?: string) => {
    if (question?.trim()) setPendingQuestion(question.trim());
    setOpen(true);
  }, []);

  const closeAsk = useCallback(() => setOpen(false), []);

  // Command-K is the only shortcut in the product, so it gets the one gesture
  // everybody already knows. Ignored while typing in a field, where it is not
  // wanted, and prevented so the browser's own find bar stays out of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<AskState>(() => ({ open, openAsk, closeAsk }), [closeAsk, open, openAsk]);

  return (
    <AskContext.Provider value={value}>
      {children}
      <AskOverlay
        open={open}
        onClose={closeAsk}
        pendingQuestion={pendingQuestion}
        onConsumed={() => setPendingQuestion(null)}
      />
    </AskContext.Provider>
  );
}

function AskOverlay({
  open,
  onClose,
  pendingQuestion,
  onConsumed,
}: {
  open: boolean;
  onClose: () => void;
  pendingQuestion: string | null;
  onConsumed: () => void;
}) {
  const { overview, refreshMemory } = useWorkspace();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [openEntity, setOpenEntity] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

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

  // A question typed into the dashboard field arrives with the overlay.
  useEffect(() => {
    if (!open || !pendingQuestion) return;
    onConsumed();
    ask(pendingQuestion);
  }, [ask, onConsumed, open, pendingQuestion]);

  // Escape closes, and the page underneath holds still while it is open.
  useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement;
    const root = document.documentElement;
    root.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      // Removed rather than reset, so the stylesheet's `overflow-x: clip` — which
      // the scroll-linked animations on the marketing page depend on — comes back.
      root.style.removeProperty("overflow");
      if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (exchanges.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  const empty = exchanges.length === 0;
  const knows = (overview?.entities ?? 0) > 0;
  const openers = openersFrom(overview);

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE.soft }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-ink/[0.14] backdrop-blur-[3px]"
            />

            <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] sm:pt-[13vh]">
              <motion.div
                key="panel"
                role="dialog"
                aria-modal="true"
                aria-label="Ask Relay"
                initial={{ opacity: 0, y: -12, scale: 0.975 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.985 }}
                transition={{ duration: 0.34, ease: EASE.out }}
                className="pointer-events-auto flex w-full max-w-[680px] flex-col overflow-hidden rounded-[28px] border border-rule bg-paper shadow-lift"
              >
                <header className="flex items-center gap-2.5 px-6 pb-3 pt-5">
                  <span className="text-ink-25">
                    <Logo size={17} />
                  </span>
                  <h2 className="text-[13px] font-medium tracking-[-0.008em] text-ink-45">
                    Ask Relay
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto rounded-md px-2 py-1 text-[11.5px] tracking-[0.02em] text-ink-25 transition-colors duration-300 hover:text-ink-45"
                  >
                    esc
                  </button>
                </header>

                {/* The conversation. Grows with the thread and scrolls inside the
                    panel, so the panel never outgrows the window. */}
                <div className="max-h-[min(58vh,520px)] overflow-y-auto px-6">
                  {empty ? (
                    <div className="pb-5">
                      <p className="text-[17px] leading-[1.55] tracking-[-0.016em] text-ink">
                        {knows
                          ? "What do you want to know?"
                          : "I have not read anything yet."}
                      </p>
                      <p className="mt-2 max-w-[52ch] text-[14.5px] leading-[1.6] tracking-[-0.011em] text-ink-45">
                        {knows
                          ? `I have ${overview?.entities} memories from your connected tools, and every answer shows where it came from.`
                          : "Connect a company tool and I will start building memory. Until then, anything I told you would be a guess."}
                      </p>

                      {openers.length > 0 && (
                        <div className="mt-5 flex flex-col items-start gap-1">
                          {openers.map((question, i) => (
                            <motion.button
                              key={question}
                              type="button"
                              onClick={() => ask(question)}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                duration: 0.5,
                                delay: 0.12 + i * 0.06,
                                ease: EASE.out,
                              }}
                              className="-mx-2 rounded-lg px-2 py-1.5 text-left text-[14.5px] tracking-[-0.012em] text-ink-70 transition-colors duration-300 hover:bg-ink/[0.03] hover:text-ink"
                            >
                              {question}
                            </motion.button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-10 pb-6 pt-1">
                      {exchanges.map((exchange, i) => (
                        <article key={exchange.id}>
                          <p className="text-[14px] leading-[1.5] tracking-[-0.011em] text-ink-45">
                            {exchange.question}
                          </p>
                          <div className="mt-4">
                            {exchange.answer ? (
                              <Answer
                                answer={exchange.answer}
                                latest={i === exchanges.length - 1}
                                onAsk={ask}
                                onOpenEntity={setOpenEntity}
                              />
                            ) : exchange.error ? (
                              <p className="text-[15.5px] tracking-[-0.012em] text-ink-45">
                                {exchange.error}
                              </p>
                            ) : (
                              <Thinking />
                            )}
                          </div>
                        </article>
                      ))}
                      <div ref={endRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-rule p-3">
                  <Composer
                    ref={inputRef}
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => ask(draft)}
                    pending={pending}
                  />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <EntityDrawer
        entityId={openEntity}
        onClose={() => setOpenEntity(null)}
        onOpenEntity={setOpenEntity}
        onAsk={(question) => {
          setOpenEntity(null);
          ask(question);
        }}
      />
    </>
  );
}

/**
 * The one input in the product.
 *
 * Grows with the question rather than scrolling it out of sight. Enter sends;
 * shift and enter is a new line, which is the convention every writing surface
 * shares.
 */
function Composer({
  ref,
  value,
  onChange,
  onSubmit,
  pending,
}: {
  ref: React.Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative"
    >
      <textarea
        ref={(node) => {
          inner.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node;
        }}
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
        autoFocus
        placeholder="Ask about a decision, a project, a person…"
        aria-label="Ask Relay about your company"
        className="block w-full resize-none rounded-[20px] bg-transparent py-3 pl-4 pr-[52px] text-[16px] leading-[1.5] tracking-[-0.013em] text-ink outline-none placeholder:text-ink-25"
      />
      <button
        type="submit"
        disabled={pending || value.trim().length === 0}
        aria-label="Ask"
        className="absolute bottom-[6px] right-[6px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-ink text-paper transition-all duration-400 hover:bg-blue disabled:opacity-20"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}

/** The phases retrieval actually goes through, named honestly. */
const PHASES = ["Searching memory", "Following connections", "Checking the sources"];

/**
 * The pause while memory is searched. The mark pulses at the weight of a
 * hairline, so the wait looks like Relay rather than like a spinner bolted on.
 */
function Thinking() {
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
