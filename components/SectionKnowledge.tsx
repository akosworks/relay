"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Words, Rise } from "./Reveal";

export function SectionKnowledge() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // The statement and the answer to it drift at different rates.
  const headingY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const bodyY = useTransform(scrollYProgress, [0, 1], [80, -80]);

  return (
    <section
      id="knowledge"
      ref={ref}
      className="mx-auto max-w-[1240px] px-6 py-[clamp(140px,20vh,260px)] sm:px-10"
    >
      <motion.div style={{ y: headingY }}>
        <Words
          text="Organizations lose knowledge every time someone leaves."
          as="h2"
          className="display max-w-[15ch] text-[clamp(2.15rem,6vw,5rem)]"
          step={0.045}
        />
      </motion.div>

      <motion.div style={{ y: bodyY }} className="mt-14 flex justify-end sm:mt-24">
        <Rise delay={0.15} className="max-w-[48ch]">
          <p className="text-[clamp(1.05rem,1.5vw,1.3rem)] leading-[1.6] tracking-[-0.014em] text-ink-70">
            Relay remembers the work, conversations, decisions, and context so every new
            employee starts with years of understanding instead of searching through old
            files.
          </p>
        </Rise>
      </motion.div>
    </section>
  );
}
