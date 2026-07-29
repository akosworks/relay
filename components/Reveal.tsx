"use client";

import { Fragment } from "react";
import { motion, type Variants } from "motion/react";
import { EASE } from "@/lib/motion";

const VIEWPORT = { once: true, margin: "0px 0px -18% 0px" } as const;

/** A real, breakable space. Written as an escape so it survives formatting. */
const SPACE = " ";

/**
 * Words rise out of a clipping mask, one after another. The stagger is small
 * enough that the line still reads as a line, not as a list of words.
 */
export function Words({
  text,
  className,
  delay = 0,
  step = 0.055,
  duration = 1.05,
  as: Tag = "span",
  inView = true,
}: {
  text: string;
  className?: string;
  delay?: number;
  step?: number;
  duration?: number;
  as?: "span" | "h1" | "h2" | "h3" | "p";
  inView?: boolean;
}) {
  const words = text.split(SPACE);

  const container: Variants = {
    hidden: {},
    shown: { transition: { delayChildren: delay, staggerChildren: step } },
  };
  const word: Variants = {
    hidden: { y: "110%" },
    shown: { y: "0%", transition: { duration, ease: EASE.out } },
  };

  const MotionTag = motion[Tag];

  return (
    <MotionTag
      className={className}
      variants={container}
      initial="hidden"
      {...(inView
        ? { whileInView: "shown", viewport: VIEWPORT }
        : { animate: "shown" })}
    >
      {words.map((w, i) => (
        // The space sits between the masks, never inside one: trailing
        // whitespace within an inline-block is dropped by the layout engine.
        <Fragment key={`${w}-${i}`}>
          <span className="inline-block overflow-hidden pb-[0.16em] -mb-[0.16em] align-bottom">
            <motion.span className="inline-block" variants={word}>
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? SPACE : null}
        </Fragment>
      ))}
    </MotionTag>
  );
}

/** Quiet entrance for anything that is not display type. */
export function Rise({
  children,
  className,
  delay = 0,
  y = 22,
  duration = 1.1,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration, delay, ease: EASE.out }}
    >
      {children}
    </motion.div>
  );
}

/** A hairline that draws itself from the left. */
export function Rule({
  className = "",
  delay = 0,
  duration = 1.4,
}: {
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={`h-px w-full origin-left bg-rule ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={VIEWPORT}
      transition={{ duration, delay, ease: EASE.inOut }}
    />
  );
}
