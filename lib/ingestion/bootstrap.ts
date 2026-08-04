import { connectIntegration } from "./pipeline";
import { listConnectors } from "@/lib/integrations/registry";
import { getIntegrationState } from "@/lib/integrations/state";
import { getSupabase } from "@/lib/supabase/client";
import { getUserId } from "@/lib/user";

/**
 * Without Supabase configured, bootstrap state is a process-local boolean —
 * fine for a long-lived dev server, useless on serverless, where every cold
 * instance would re-run it. With Supabase configured, `workspace_meta` is the
 * flag instead, so a cold instance sees the workspace is already seeded and
 * skips straight to reading what's there.
 */
const BOOTSTRAP_KEY = Symbol.for("relay.bootstrap");
type Global = typeof globalThis & { [BOOTSTRAP_KEY]?: boolean };

async function isBootstrapped(): Promise<boolean> {
  const db = getSupabase();
  if (!db) return Boolean((globalThis as Global)[BOOTSTRAP_KEY]);

  const { data, error } = await db
    .from("workspace_meta")
    .select("bootstrapped_at")
    .eq("user_id", getUserId())
    .maybeSingle();
  if (error) throw new Error(`workspace_meta select failed: ${error.message}`);
  return Boolean(data?.bootstrapped_at);
}

async function markBootstrapped(): Promise<void> {
  const db = getSupabase();
  if (!db) {
    (globalThis as Global)[BOOTSTRAP_KEY] = true;
    return;
  }

  const { error } = await db
    .from("workspace_meta")
    .upsert(
      { user_id: getUserId(), bootstrapped_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(`workspace_meta upsert failed: ${error.message}`);
}

export async function ensureBootstrapMemory(): Promise<void> {
  if (await isBootstrapped()) return;

  await markBootstrapped();

  try {
    const connectors = listConnectors();
    for (const connector of connectors) {
      const state = await getIntegrationState(connector.id);
      if (state?.status === "connected") continue;
      await connectIntegration(connector.id);
    }
  } catch {
    // Keep the app usable even if bootstrap fails; the chat endpoint will still
    // return the fallback message while the user connects a source manually.
  }
}
