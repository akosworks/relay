import {
  connectIntegration,
  disconnectIntegration,
  syncIntegration,
} from "@/lib/ingestion/pipeline";
import { getConnector } from "@/lib/integrations/registry";
import { integrationSummary } from "@/lib/integrations/state";

type Action = "connect" | "disconnect" | "sync";

/**
 * Connect, disconnect or re-sync one source. The route is a thin shell: all
 * three actions are pipeline operations, so a real OAuth flow would slot in
 * here without touching ingestion.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!getConnector(id)) {
    return Response.json({ error: `Unknown integration: ${id}` }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { action?: Action };
  const action = body.action ?? "sync";

  try {
    if (action === "disconnect") {
      await disconnectIntegration(id);
      return Response.json({ integration: integrationSummary(id), report: null });
    }

    const report =
      action === "connect" ? await connectIntegration(id) : await syncIntegration(id);
    return Response.json({ integration: integrationSummary(id), report });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 },
    );
  }
}
