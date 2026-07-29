import { getWorkspace } from "@/lib/workspace/store";

/** Everything the user owns: their tasks and their calendar, in one request. */
export async function GET() {
  return Response.json(getWorkspace());
}
