import { getSupabase } from "@/lib/supabase/client";
import { getUserId } from "@/lib/user";

/**
 * What the user has ticked off, kept apart from what memory believes.
 *
 * Memory's view of a piece of work comes from its source — a pull request is
 * merged, an issue is closed — and Relay must not overwrite that, because the
 * source is the thing it can cite. So a person marking work done is recorded as
 * an override on top: memory still says what GitHub said, and the board shows
 * what the person said. A row per user per entity, once Supabase is configured;
 * an in-process map otherwise.
 */
const CACHE_KEY = Symbol.for("relay.taskOverrides");

export interface TaskOverride {
  done: boolean;
  at: string;
}

type Global = typeof globalThis & { [CACHE_KEY]?: Map<string, TaskOverride> };

function memoryTable(): Map<string, TaskOverride> {
  const g = globalThis as Global;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new Map();
  return g[CACHE_KEY];
}

export async function getOverride(entityId: string): Promise<TaskOverride | null> {
  const db = getSupabase();
  if (!db) return memoryTable().get(entityId) ?? null;

  const { data, error } = await db
    .from("task_overrides")
    .select()
    .eq("user_id", getUserId())
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw new Error(`task_overrides select failed: ${error.message}`);
  return data ? { done: data.done as boolean, at: data.at as string } : null;
}

export async function setOverride(entityId: string, done: boolean): Promise<TaskOverride> {
  const override: TaskOverride = { done, at: new Date().toISOString() };
  const db = getSupabase();
  if (!db) {
    memoryTable().set(entityId, override);
    return override;
  }

  const { error } = await db
    .from("task_overrides")
    .upsert(
      { user_id: getUserId(), entity_id: entityId, done: override.done, at: override.at },
      { onConflict: "user_id,entity_id" },
    );
  if (error) throw new Error(`task_overrides upsert failed: ${error.message}`);
  return override;
}

export async function allOverrides(): Promise<Map<string, TaskOverride>> {
  const db = getSupabase();
  if (!db) return memoryTable();

  const { data, error } = await db
    .from("task_overrides")
    .select()
    .eq("user_id", getUserId());
  if (error) throw new Error(`task_overrides list failed: ${error.message}`);

  const map = new Map<string, TaskOverride>();
  for (const row of data ?? []) {
    map.set(row.entity_id as string, { done: row.done as boolean, at: row.at as string });
  }
  return map;
}
