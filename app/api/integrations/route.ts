import { listPlanned } from "@/lib/integrations/registry";
import { listIntegrationSummaries } from "@/lib/integrations/state";

/** Every source, connectable or not. Planned ones are kept in their own list. */
export async function GET() {
  return Response.json({
    integrations: listIntegrationSummaries(),
    planned: listPlanned(),
  });
}
