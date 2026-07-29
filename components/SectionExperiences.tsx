"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Words, Rule } from "./Reveal";
import { EASE, SPRING } from "@/lib/motion";

const EXPERIENCES = [
  {
    name: "Organizational Brain",
    line: "Acts like the nexus of a company, serving as the primary hub for innovation, as it learns from other employees.",
  },
  {
    name: "Calendar",
    line: "Automatically schedules meetings and important events for you.",
  },
  {
    name: "Tasks",
    line: "Stays on top of all the little tasks, so that you can focus on the big developments.",
  },
  {
    name: "Email",
    line: "Every email is automatically organized, connected, and transformed into searchable organizational knowledge that never gets lost.",
  },
];

function Row({ name, line, index }: { name: string; line: string; index: number }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="relative pt-9 pb-14 md:pt-12 md:pb-20"
    >
      <div className="absolute inset-x-0 top-0">
        <Rule delay={index * 0.05} />
        {/* Accent grows from the left on approach and retreats to the right on
            the way out, so arriving and leaving are not the same gesture. */}
        <motion.div
          className="absolute inset-x-0 top-0 h-px bg-blue"
          style={{ transformOrigin: hover ? "left" : "right" }}
          initial={false}
          animate={{ scaleX: hover ? 1 : 0 }}
          transition={{ duration: 0.7, ease: EASE.out }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        <motion.div
          className="md:col-span-6"
          animate={{ x: hover ? 16 : 0 }}
          transition={SPRING.magnet}
        >
          <Words
            text={name}
            as="h3"
            className="display text-[clamp(1.85rem,4.6vw,3.5rem)]"
            step={0.05}
            delay={index * 0.04}
          />
        </motion.div>

        <motion.div
          className="md:col-span-5 md:col-start-8 md:pt-3"
          animate={{ x: hover ? 8 : 0 }}
          transition={{ ...SPRING.magnet, damping: 26 }}
        >
          <Words
            text={line}
            as="p"
            className="max-w-[34ch] text-[clamp(1rem,1.25vw,1.125rem)] leading-[1.6] tracking-[-0.012em] text-ink-70"
            step={0.02}
            duration={0.85}
            delay={0.12 + index * 0.04}
          />
        </motion.div>
      </div>
    </div>
  );
}

export function SectionExperiences() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 pb-[clamp(140px,20vh,260px)] sm:px-10">
      {EXPERIENCES.map((item, i) => (
        <Row key={item.name} index={i} {...item} />
      ))}
      <Rule />
    </section>
  );
}
