"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { LiveHeadline } from "./LiveHeadline";
import { Button } from "./Button";
import { Words } from "./Reveal";

export function Hero({ onDiscover }: { onDiscover: () => void }) {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // The first screen recedes rather than slides away.
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.93]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] items-center justify-center px-6"
    >
      <motion.div
        style={{ y, scale, opacity }}
        className="flex w-full flex-col items-center text-center"
      >
        <LiveHeadline
          text="Introducing Relay"
          delay={0.35}
          className="display text-[clamp(2.75rem,8.6vw,7rem)]"
        />

        <div className="mt-8 text-[clamp(1.05rem,1.6vw,1.375rem)] leading-[1.45] tracking-[-0.018em] text-ink-70 sm:mt-10">
          <Words
            text="Built to remember."
            as="p"
            inView={false}
            delay={0.95}
            duration={0.95}
          />
          <Words text="Built to act." as="p" inView={false} delay={1.06} duration={0.95} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 1.35, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14 flex flex-wrap items-center justify-center gap-3 sm:mt-16 sm:gap-4"
        >
          <Button onClick={onDiscover}>Discover more</Button>
          <Button href="/login" variant="solid">
            Get Started
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
