"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * The reader's clock.
 *
 * Two pages need to know what time it is where the person is sitting — the
 * date under "Welcome back" and how much of the workday is left — and neither
 * can be answered on the server, because the server is in a different timezone
 * and rendering its answer would flash the wrong one before hydration corrects
 * it. So the clock is treated as what it is, an external system: `null` until
 * the client has one, then a Date that changes once a minute.
 *
 * Resolution is deliberately a minute. Nothing on screen counts seconds, and a
 * snapshot that changed on every tick would re-render the page sixty times a
 * minute to show the same thing.
 */
const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  // Twice per minute, so a minute boundary is never more than 30s stale.
  const timer = window.setInterval(onChange, MINUTE / 2);
  return () => window.clearInterval(timer);
}

/** A primitive, so React can compare snapshots and skip the render when equal. */
function snapshot(): number {
  return Math.floor(Date.now() / MINUTE);
}

function serverSnapshot(): null {
  return null;
}

export function useNow(): Date | null {
  const minute = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => (minute === null ? null : new Date(minute * MINUTE)), [minute]);
}
