"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { EASE } from "@/lib/motion";

/**
 * The frame the memory lives in.
 *
 * Fixed, hairline-ruled, and the same height wherever you are — the marketing
 * header contracts on scroll because the page is a performance; here the
 * conversation is the performance and the frame should hold still.
 */
const LINKS = [
  { href: "/chat", label: "Ask" },
  { href: "/integrations", label: "Sources" },
];

export function AppShell({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-[100svh]">
      <motion.header
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE.out }}
        className="fixed inset-x-0 top-0 z-40 h-[64px] bg-paper/85 backdrop-blur-md"
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-rule" />
        <nav className="mx-auto flex h-full max-w-[1240px] items-center gap-8 px-6 sm:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-ink" aria-label="Relay, home">
            <Logo size={22} />
            <span className="text-[16px] font-medium tracking-[-0.025em]">Relay</span>
          </Link>

          <div className="flex items-center gap-6">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1 text-[14px] tracking-[-0.012em] transition-colors duration-400 ${
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
        </nav>
      </motion.header>

      <div className="mx-auto flex max-w-[1240px] gap-10 px-6 pt-[64px] sm:px-10">
        <main className="min-w-0 flex-1">{children}</main>
        {aside ? (
          <aside className="hidden w-[276px] shrink-0 py-10 xl:block">
            <div className="sticky top-[104px]">{aside}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
