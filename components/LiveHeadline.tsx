"use client";

import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  type MotionValue,
  type Variants,
} from "motion/react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { EASE, SPRING } from "@/lib/motion";
import { useFinePointer } from "@/lib/useFinePointer";

/** How far the cursor's influence reaches, and how far a letter will travel. */
const RADIUS = 200;
const LIFT = 9;
const LEAN = 4;

/** A real, breakable space. */
const SPACE = " ";

type Pointer = { x: number; y: number };

function Glyph({
  char,
  pulse,
  pointer,
  active,
}: {
  char: string;
  pulse: MotionValue<number>;
  pointer: React.RefObject<Pointer>;
  active: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const centre = useRef({ x: 0, y: 0 });

  const x = useSpring(0, SPRING.glyph);
  const y = useSpring(0, SPRING.glyph);

  // Cache the letter's page position so pointer moves never force a layout.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    centre.current = {
      x: r.left + r.width / 2 + window.scrollX,
      y: r.top + r.height / 2 + window.scrollY,
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(measure).catch(() => {});
    const settle = window.setTimeout(measure, 1800);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(settle);
    };
  }, [active, measure]);

  useMotionValueEvent(pulse, "change", () => {
    if (!active) return;
    const p = pointer.current;
    const dx = p.x - centre.current.x;
    const dy = p.y - centre.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist > RADIUS) {
      x.set(0);
      y.set(0);
      return;
    }

    // Squared falloff: the effect stays local instead of smearing across the line.
    const f = (1 - dist / RADIUS) ** 2;
    x.set((dx / RADIUS) * LEAN * f * 3);
    y.set(-LIFT * f);
  });

  return (
    <motion.span
      ref={ref}
      className="inline-block will-change-transform"
      style={active ? { x, y } : undefined}
    >
      {char}
    </motion.span>
  );
}

/**
 * Display type that notices the cursor. Letters near it lift and lean a few
 * pixels, then settle back. On touch and under reduced motion the headline is
 * plain text that simply reveals itself.
 */
export function LiveHeadline({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const active = useFinePointer();
  const [entered, setEntered] = useState(false);

  const pulse = useMotionValue(0);
  const pointer = useRef<Pointer>({ x: -9999, y: -9999 });

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
      pulse.set(pulse.get() + 1);
    };
    const onLeave = () => {
      pointer.current = { x: -9999, y: -9999 };
      pulse.set(pulse.get() + 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [active, pulse]);

  const words = text.split(SPACE);

  // The cursor effect switches on when the entrance finishes. A timer backs up
  // the animation callback so the headline can never be left inert if that
  // callback is missed.
  useEffect(() => {
    const total = (delay + words.length * 0.09 + 1.25 + 0.3) * 1000;
    const t = window.setTimeout(() => setEntered(true), total);
    return () => window.clearTimeout(t);
  }, [delay, words.length]);

  const container: Variants = {
    hidden: {},
    shown: { transition: { delayChildren: delay, staggerChildren: 0.09 } },
  };
  const word: Variants = {
    hidden: { y: "112%" },
    shown: { y: "0%", transition: { duration: 1.25, ease: EASE.out } },
  };

  return (
    <motion.h1
      className={className}
      variants={container}
      initial="hidden"
      animate="shown"
      onAnimationComplete={() => setEntered(true)}
    >
      {words.map((w, wi) => (
        <Fragment key={`${w}-${wi}`}>
          <span
            className={
              // The mask is dropped once the entrance is done, otherwise it
              // would clip the letters as they lift toward the cursor.
              entered
                ? "inline-block"
                : "inline-block overflow-hidden pb-[0.18em] -mb-[0.18em] align-bottom"
            }
          >
            <motion.span className="inline-block" variants={word}>
              {[...w].map((c, ci) => (
                <Glyph
                  key={`${c}-${ci}`}
                  char={c}
                  pulse={pulse}
                  pointer={pointer}
                  active={active && entered}
                />
              ))}
            </motion.span>
          </span>
          {wi < words.length - 1 ? SPACE : null}
        </Fragment>
      ))}
    </motion.h1>
  );
}
