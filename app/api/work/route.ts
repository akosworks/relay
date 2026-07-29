import { getBoard } from "@/lib/tasks/board";

/**
 * Work in flight, gathered out of memory — pull requests still open, issues
 * nobody closed. Distinct from `/api/workspace/tasks`, which is the user's own
 * list: this is what their tools are still carrying, and Relay cannot edit it.
 */
export async function GET() {
  return Response.json(await getBoard());
}
