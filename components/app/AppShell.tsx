"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { EASE } from "@/lib/motion";
import { AppBackdrop } from "./AppBackdrop";
import { useAsk } from "./Ask";

/**
 * The frame the workspace lives in.
 *
 * Fixed, hairline-ruled, and exactly the same height wherever you are. The
 * marketing header contracts on scroll because that page is a performance; here
 * you are working, and a frame that moves while you read is a frame you notice.
 *
 * Three destinations, because asking is not one. Ask lives in the button on the
 * right, which opens over whatever you are looking at rather than taking you
 * somewhere — the one interaction that should never cost you your place.
 */
const LINKS = [
  { href: "/home", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks" },
  { href: "/integrations", label: "Integrations" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { openAsk } = useAsk();

  const signOut = async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    router.push("/login");
    // The proxy reads the cookie on the server, so the next route has to come
    // from there rather than from the client's cache of the signed-in one.
    router.refresh();
  };

  return (
    <div className="relative min-h-[100svh]">
      <AppBackdrop />

      <motion.header
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE.out }}
        className="fixed inset-x-0 top-0 z-40 h-[64px] bg-paper/72 backdrop-blur-xl"
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-rule" />
        <nav className="mx-auto flex h-full max-w-[1180px] items-center gap-6 px-6 sm:gap-9 sm:px-10">
          <Link
            href="/home"
            className="flex shrink-0 items-center gap-2.5 text-ink"
            aria-label="Relay, home"
          >
            <Logo size={22} />
            {/* The wordmark is the first thing to go when space is tight; the
                mark alone still says where you are. */}
            <span className="hidden text-[16px] font-medium tracking-[-0.025em] sm:block">
              Relay
            </span>
          </Link>

          <div className="rail flex items-center gap-6 overflow-x-auto">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative shrink-0 py-1 text-[14px] tracking-[-0.012em] transition-colors duration-400 ${
                    active ? "text-ink" : "text-ink-45 hover:text-ink"
                  }`}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="app-nav-underline"
                      className="absolute -bottom-[3px] left-0 h-px w-full bg-ink"
                      transition={{ duration: 0.5, ease: EASE.out }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => openAsk()}
            className="group ml-auto flex shrink-0 items-center gap-2.5 rounded-full border border-rule py-[7px] pl-4 pr-[7px] transition-colors duration-400 hover:border-ink-25"
          >
            <span className="text-[13.5px] tracking-[-0.012em] text-ink-45 transition-colors duration-400 group-hover:text-ink">
              Ask Relay
            </span>
            <kbd className="rounded-[7px] bg-ink/[0.045] px-[7px] py-[3px] font-sans text-[11px] tracking-[0.02em] text-ink-45">
              ⌘K
            </kbd>
          </button>

          {/* A door you cannot leave by is not a door. */}
          <button
            type="button"
            onClick={signOut}
            className="shrink-0 text-[13px] tracking-[-0.01em] text-ink-25 transition-colors duration-400 hover:text-ink-45"
          >
            Sign out
          </button>
        </nav>
      </motion.header>

      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-6 pt-[64px] sm:px-10">
        {children}
      </main>
    </div>
  );
}
