import { connectIntegration } from "./pipeline";
import { listConnectors } from "@/lib/integrations/registry";
import { getIntegrationState } from "@/lib/integrations/state";

const BOOTSTRAP_KEY = Symbol.for("relay.bootstrap");

type Global = typeof globalThis & { [BOOTSTRAP_KEY]?: boolean };

export async function ensureBootstrapMemory(): Promise<void> {
  const g = globalThis as Global;
  if (g[BOOTSTRAP_KEY]) return;

  g[BOOTSTRAP_KEY] = true;

  try {
    const connectors = listConnectors();
    for (const connector of connectors) {
      const state = getIntegrationState(connector.id);
      if (state?.status === "connected") continue;
      await connectIntegration(connector.id);
    }
  } catch {
    // Keep the app usable even if bootstrap fails; the chat endpoint will still
    // return the fallback message while the user connects a source manually.
  }
}
