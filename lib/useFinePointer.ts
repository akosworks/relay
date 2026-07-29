"use client";

import { useEffect, useState } from "react";

/**
 * True only for a real pointer on a device that is not asking for less motion.
 * Cursor-driven effects are meaningless on touch and unwelcome under
 * reduced motion, so both opt out of the same gate.
 */
export function useFinePointer() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const pointer = window.matchMedia("(pointer: fine)");
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => setEnabled(pointer.matches && !motion.matches);
    update();

    pointer.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => {
      pointer.removeEventListener("change", update);
      motion.removeEventListener("change", update);
    };
  }, []);

  return enabled;
}
