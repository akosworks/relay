import { getBoard } from "@/lib/tasks/board";
import { setOverride } from "@/lib/tasks/state";
import { getStorage } from "@/lib/storage";

/**
 * Tick a piece of work off, or put it back.
 *
 * The whole board comes back rather than the one item, because every number on
 * the page — completion, remaining, estimated effort — moves when one item does,
 * and one response that agrees with itself beats five that might not.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const entity = await getStorage().memory.getEntity(id);
  if (!entity) {
    return Response.json({ error: "No such memory." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { done?: boolean } | null;
  if (typeof body?.done !== "boolean") {
    return Response.json({ error: "`done` must be true or false." }, { status: 400 });
  }

  await setOverride(id, body.done);
  return Response.json(await getBoard());
}
