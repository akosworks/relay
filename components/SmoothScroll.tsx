"use client";

import Lenis from "lenis";
import { MotionConfig, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

type ScrollTo = (target: string | HTMLElement, options?: { duration?: number }) => void;

const ScrollContext = createContext<ScrollTo>(() => {});

export const useSmoothScrollTo = () => useContext(ScrollContext);

/**
 * Weight on the scroll. Lenis drives the real window scroll, so `useScroll`
 * and anchor semantics keep working; it only changes how the page arrives.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced !== false) return;

    const lenis = new Lenis({
      duration: 1.15,
      // Exponential settle. Fast to leave, slow to land.
      easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.95,
      touchMultiplier: 1.6,
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  const scrollTo = useCallback<ScrollTo>((target, options) => {
    const el =
      typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
    if (!el) return;

    const lenis = lenisRef.current;
    if (!lenis) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    lenis.scrollTo(el, {
      duration: options?.duration ?? 1.9,
      // Long, weighted travel. Nothing snaps.
      easing: (t) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    });
  }, []);

  return (
    <ScrollContext.Provider value={scrollTo}>
      {/* Framer Motion drives transforms in JS, so the reduced-motion media
          query in CSS cannot reach them. This does: movement is dropped and
          only opacity is allowed to animate. */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ScrollContext.Provider>
  );
}
