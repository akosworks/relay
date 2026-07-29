"use client";

import Link from "next/link";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { Logo } from "./Logo";
import { EASE, SPRING } from "@/lib/motion";

export function Nav() {
  const { scrollY } = useScroll();

  // Everything settles through one spring so the bar contracts as a single object.
  const progress = useSpring(useTransform(scrollY, [0, 180], [0, 1]), SPRING.scroll);

  const height = useTransform(progress, [0, 1], [104, 64]);
  const scale = useTransform(progress, [0, 1], [1, 0.86]);
  const ruleOpacity = useTransform(progress, [0, 1], [0, 1]);

  return (
    <motion.header
      style={{ height }}
      className="fixed inset-x-0 top-0 z-50 bg-paper"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.1, ease: EASE.out, delay: 0.1 }}
    >
      <motion.div
        style={{ opacity: ruleOpacity }}
        className="absolute inset-x-0 bottom-0 h-px bg-rule"
      />

      <nav className="mx-auto flex h-full max-w-[1240px] items-center px-6 sm:px-10">
        <motion.div style={{ scale }} className="origin-left">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-ink"
            aria-label="Relay, home"
          >
            <Logo size={26} animateOnMount />
            <span className="text-[17px] font-medium tracking-[-0.025em]">Relay</span>
          </Link>
        </motion.div>

        <motion.div style={{ scale }} className="ml-auto origin-right">
          <Link
            href="/chat"
            className="text-[15px] tracking-[-0.012em] text-ink-45 transition-colors duration-500 hover:text-ink"
          >
            Ask Relay
          </Link>
        </motion.div>
      </nav>
    </motion.header>
  );
}
