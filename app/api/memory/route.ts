import { getMemoryOverview } from "@/lib/memory/overview";

/** What memory currently holds. Read by the dashboard and by the Ask page. */
export async function GET() {
  return Response.json(await getMemoryOverview());
}
