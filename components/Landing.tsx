"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Nav } from "./Nav";
import { Backdrop } from "./Backdrop";
import { Hero } from "./Hero";
import { SectionKnowledge } from "./SectionKnowledge";
import { SectionExperiences } from "./SectionExperiences";
import { Close } from "./Close";
import { useSmoothScrollTo } from "./SmoothScroll";
import { EASE } from "@/lib/motion";

/**
 * The first screen is the whole page until it is asked to be more.
 *
 * Nothing below the hero exists in the document yet, so there is nowhere to
 * scroll to and no way to arrive somewhere by accident. Asking for more, either
 * by pressing the button or simply by trying to scroll, unfolds the rest in
 * place. Pressing the button also carries you down; scrolling does not, because
 * you are already moving and being taken somewhere would fight you.
 */
export function Landing() {
  const [revealed, setRevealed] = useState(false);
  const carryDown = useRef(false);
  const scrollTo = useSmoothScrollTo();

  const discover = useCallback(() => {
    if (revealed) {
      scrollTo("#knowledge");
      return;
    }
    carryDown.current = true;
    setRevealed(true);
  }, [revealed, scrollTo]);

  // Trying to scroll is a request for the rest of the page.
  useEffect(() => {
    if (revealed) return;

    const open = () => setRevealed(true);

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 2) open();
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "End", " "].includes(e.key)) open();
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY - e.touches[0].clientY > 20) open();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [revealed]);

  // Let the new sections lay out and start moving before travelling to them.
  useEffect(() => {
    if (!revealed || !carryDown.current) return;
    carryDown.current = false;
    const t = window.setTimeout(() => scrollTo("#knowledge", { duration: 2.1 }), 320);
    return () => window.clearTimeout(t);
  }, [revealed, scrollTo]);

  return (
    <>
      <Backdrop />
      <Nav />
      <main className="relative z-10">
        <Hero onDiscover={discover} />

        <AnimatePresence>
          {revealed && (
            <motion.div
              key="unfolded"
              initial={{ opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.3, ease: EASE.out }}
            >
              <SectionKnowledge />
              <SectionExperiences />
              <Close />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
