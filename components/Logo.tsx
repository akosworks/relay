"use client";

import { motion, type Variants } from "motion/react";
import { EASE } from "@/lib/motion";

/**
 * The Relay mark.
 *
 * One unbroken stroke folded twice: it rises, turns over, runs back down,
 * turns under, and rises again. Both folds share a radius and both open ends
 * are cut at the same length, which makes the form symmetrical under a 180
 * degree rotation. Built on a 32 unit grid from two true semicircles.
 */
export const MARK = "M8.5 23V11.25a3.75 3.75 0 0 1 7.5 0v9.5a3.75 3.75 0 0 0 7.5 0V9";

const strokeVariants: Variants = {
  rest: { pathLength: 1 },
  draw: {
    pathLength: [0, 1],
    transition: { duration: 1.15, ease: EASE.out },
  },
};

export function Logo({
  size = 26,
  className,
  animateOnMount = false,
}: {
  size?: number;
  className?: string;
  animateOnMount?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ overflow: "visible" }}
    >
      <motion.path
        d={MARK}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={strokeVariants}
        initial={animateOnMount ? { pathLength: 0 } : "rest"}
        animate={
          animateOnMount
            ? { pathLength: 1, transition: { duration: 1.4, ease: EASE.out, delay: 0.15 } }
            : undefined
        }
      />
    </svg>
  );
}

/** Static version for anywhere motion is not wanted (favicons, print, fallbacks). */
export function LogoStatic({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d={MARK}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
