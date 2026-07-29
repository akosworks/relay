"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { MARK } from "./Logo";
import { SPRING } from "@/lib/motion";
import { useFinePointer } from "@/lib/useFinePointer";

/** Column and row positions, as fractions of the viewport. Deliberately uneven. */
const COLUMNS = [0.11, 0.31, 0.5, 0.69, 0.89];
const ROWS = [0.26, 0.61, 0.87];

/** A long, slow sway. Durations are coprime enough never to fall into step. */
const sway = (duration: number, delay: number, distance: number) => ({
  x: [0, distance, 0],
  transition: { duration, delay, repeat: Infinity, ease: "easeInOut" as const },
});

/**
 * A structural layer behind the page: a loose grid of hairlines and one
 * oversized, nearly invisible copy of the mark.
 *
 * Everything here is a straight line or the logo itself, held at two to four
 * percent ink. It gives the white something to sit against without becoming an
 * object that competes with the type. Three things move it, all slowly and at
 * different rates: a long sway, the scroll, and the cursor.
 *
 * Every style prop is passed unconditionally. Branching on a client-only value
 * such as reduced-motion would render a different style attribute on the server
 * than on the client and break hydration; motion values all start at rest, so
 * both sides agree. Reduced motion is handled centrally by MotionConfig.
 */
export function Backdrop() {
  const fine = useFinePointer();
  const { scrollY } = useScroll();

  // Trails the page. The gap between this and the content is the depth.
  const scrollDrift = useTransform(scrollY, [0, 3000], [0, -150]);

  const pointerX = useSpring(0, SPRING.scroll);
  const pointerY = useSpring(0, SPRING.scroll);

  useEffect(() => {
    if (!fine) return;
    const onMove = (e: PointerEvent) => {
      pointerX.set((e.clientX / window.innerWidth - 0.5) * -22);
      pointerY.set((e.clientY / window.innerHeight - 0.5) * -14);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [fine, pointerX, pointerY]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <motion.div className="absolute inset-0" style={{ y: scrollDrift, x: pointerX }}>
        {COLUMNS.map((c, i) => (
          <motion.div
            key={`c-${c}`}
            // Narrow screens keep only every other line, so the grid stays airy
            // instead of turning into ruled paper.
            className={`absolute top-[-10%] h-[120%] w-px bg-ink/[0.035] ${
              i % 2 === 1 ? "hidden sm:block" : ""
            }`}
            style={{ left: `${c * 100}%` }}
            animate={sway(29 + i * 7, i * 1.6, i % 2 === 0 ? 9 : -7)}
          />
        ))}
      </motion.div>

      <motion.div className="absolute inset-0" style={{ y: pointerY }}>
        {ROWS.map((r, i) => (
          <motion.div
            key={`r-${r}`}
            className="absolute left-[-10%] h-px w-[120%] bg-ink/[0.028]"
            style={{ top: `${r * 100}%` }}
            animate={sway(37 + i * 11, 2 + i * 2.4, i % 2 === 0 ? -14 : 11)}
          />
        ))}
      </motion.div>

      {/* The mark at watermark scale, hung off the right edge. Centring lives on
          the wrapper so it cannot collide with the animated transform. */}
      {/* Only on wide viewports. On a phone it would fill the screen and stop
          being a texture. */}
      <div className="absolute top-1/2 right-[-16vw] hidden h-[72vh] w-[72vh] -translate-y-1/2 md:block">
        <motion.svg
          viewBox="0 0 32 32"
          fill="none"
          className="h-full w-full text-ink/[0.022]"
          style={{ y: scrollDrift, x: pointerX }}
          animate={{
            rotate: [0, 1.4, 0],
            transition: { duration: 48, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <path
            d={MARK}
            stroke="currentColor"
            strokeWidth={1.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </div>
    </div>
  );
}
