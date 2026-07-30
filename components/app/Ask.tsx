"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { EASE } from "@/lib/motion";
import { Composer, Openers, openersFrom, Thread, useConversation } from "./Conversation";
import { EntityDrawer } from "./EntityDrawer";
import { useWorkspace } from "./WorkspaceProvider";

/**
 * Asking Relay from somewhere that is not home.
 *
 * On home the conversation is the page — the field under the greeting answers
 * in place, because that is what you went there to do. Everywhere else, asking
 * a colleague a question should not cost you your place, so the same
 * conversation opens over the top and gets out of the way again. Command-K
 * anywhere.
 *
 * Both surfaces share `useConversation`, so there is one thread implementation
 * wearing two shapes rather than two that drift apart.
 */

interface AskState {
  open: boolean;
  /** Opens the overlay, optionally with a question already asked. */
  openAsk: (question?: string) => void;
  closeAsk: () => void;
  /**
   * Claim Command-K for an on-page ask field. Home does this: while it is
   * mounted, the shortcut belongs to the field under the greeting, because
   * opening a panel over a page that already has the conversation on it would
   * be two of the same thing.
   */
  registerInline: (focus: (() => void) | null) => void;
}

const AskContext = createContext<AskState | null>(null);

export function useAsk(): AskState {
  const value = useContext(AskContext);
  if (!value) throw new Error("useAsk must be used inside AskProvider.");
  return value;
}

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const openAsk = useCallback((question?: string) => {
    if (question?.trim()) setPendingQuestion(question.trim());
    setOpen(true);
  }, []);

  const closeAsk = useCallback(() => setOpen(false), []);

  const inlineFocus = useRef<(() => void) | null>(null);
  const registerInline = useCallback((focus: (() => void) | null) => {
    inlineFocus.current = focus;
  }, []);

  // Command-K is the only shortcut in the product, so it gets the one gesture
  // everybody already knows. Prevented so the browser's own find bar stays out
  // of it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      if (inlineFocus.current) {
        inlineFocus.current();
        return;
      }
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<AskState>(
    () => ({ open, openAsk, closeAsk, registerInline }),
    [closeAsk, open, openAsk, registerInline],
  );

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
  const { overview } = useWorkspace();
  const { exchanges, draft, setDraft, pending, ask, inputRef } = useConversation();
  const [openEntity, setOpenEntity] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<Element | null>(null);

  // A question handed over from elsewhere arrives with the overlay.
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
                        {knows ? "What do you want to know?" : "I have not read anything yet."}
                      </p>
                      <p className="mt-2 max-w-[52ch] text-[14.5px] leading-[1.6] tracking-[-0.011em] text-ink-45">
                        {knows
                          ? `I have ${overview?.entities} memories from your connected tools, and every answer shows where it came from.`
                          : "Connect a company tool and I will start building memory. Until then, anything I told you would be a guess."}
                      </p>

                      <div className="mt-5">
                        <Openers questions={openers} onAsk={ask} />
                      </div>
                    </div>
                  ) : (
                    <div className="pb-6 pt-1">
                      <Thread
                        exchanges={exchanges}
                        onAsk={ask}
                        onOpenEntity={setOpenEntity}
                        className="space-y-10"
                      />
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
                    autoFocus
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
