import { ensureBootstrapped } from "@/lib/ingestion/bootstrap";
import { getMemoryOverview } from "@/lib/memory/overview";

/** What memory currently holds, for the context panel beside the conversation. */
export async function GET() {
  await ensureBootstrapped();
  return Response.json(await getMemoryOverview());
}
