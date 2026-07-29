import { ensureBootstrapped } from "@/lib/ingestion/bootstrap";
import { listIntegrationSummaries } from "@/lib/integrations/state";

export async function GET() {
  await ensureBootstrapped();
  return Response.json({ integrations: listIntegrationSummaries() });
}
