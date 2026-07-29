import { deleteEvent, getWorkspace, updateEvent } from "@/lib/workspace/store";
import type { EventInput } from "@/lib/workspace/types";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<EventInput> | null;

  if (!body) {
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  }

  try {
    if (!updateEvent(id, body)) {
      return Response.json({ error: "No such event." }, { status: 404 });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "That change could not be made." },
      { status: 400 },
    );
  }

  return Response.json(getWorkspace());
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!deleteEvent(id)) {
    return Response.json({ error: "No such event." }, { status: 404 });
  }
  return Response.json(getWorkspace());
}
