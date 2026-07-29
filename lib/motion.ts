import type { Transition } from "motion/react";

/**
 * A small, fixed vocabulary of curves. Reusing these is what keeps motion
 * across the site feeling like one hand made it.
 */
export const EASE = {
  /** Fast departure, long quiet settle. Entrances, reveals. */
  out: [0.16, 1, 0.3, 1],
  /** Symmetric and heavy. Anything that travels a long distance. */
  inOut: [0.76, 0, 0.24, 1],
  /** Gentle. Hovers, colour, small opacity shifts. */
  soft: [0.33, 1, 0.68, 1],
} as const;

/** Physical springs for anything that follows the cursor. */
export const SPRING = {
  magnet: { stiffness: 220, damping: 22, mass: 0.55 },
  glyph: { stiffness: 160, damping: 18, mass: 0.5 },
  scroll: { stiffness: 90, damping: 26, mass: 0.4, restDelta: 0.0005 },
} as const;

export const reveal: Transition = {
  duration: 1.1,
  ease: EASE.out,
};

/** Stagger children with a gentle acceleration rather than a fixed metronome. */
export function stagger(index: number, step = 0.07, base = 0) {
  return base + index * step;
}
