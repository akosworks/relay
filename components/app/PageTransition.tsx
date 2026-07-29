"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { EASE } from "@/lib/motion";

/**
 * Arriving somewhere.
 *
 * Keyed on the path, so every navigation remounts and the new page rises into
 * place. Deliberately entrance-only: an exit animation would hold the old page
 * on screen after the click, and the one thing this product cannot afford to
 * feel is slow. Sections stagger themselves underneath this; all it provides is
 * the sense that the page arrived rather than appeared.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.62, ease: EASE.out }}
    >
      {children}
    </motion.div>
  );
}
