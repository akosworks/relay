/**
 * What the user has ticked off, kept apart from what memory believes.
 *
 * Memory's view of a piece of work comes from its source — a pull request is
 * merged, an issue is closed — and Relay must not overwrite that, because the
 * source is the thing it can cite. So a person marking work done is recorded as
 * an override on top: memory still says what GitHub said, and the board shows
 * what the person said. In production this is a row per user per entity.
 */
const CACHE_KEY = Symbol.for("relay.taskOverrides");

export interface TaskOverride {
  done: boolean;
  at: string;
}

type Global = typeof globalThis & { [CACHE_KEY]?: Map<string, TaskOverride> };

function table(): Map<string, TaskOverride> {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new Map();
  return g[CACHE_KEY];
}

export function getOverride(entityId: string): TaskOverride | null {
  return table().get(entityId) ?? null;
}

export function setOverride(entityId: string, done: boolean): TaskOverride {
  const override: TaskOverride = { done, at: new Date().toISOString() };
  table().set(entityId, override);
  return override;
}

export function allOverrides(): Map<string, TaskOverride> {
  return table();
}
