import { deleteTask, getWorkspace, updateTask } from "@/lib/workspace/store";
import type { TaskInput } from "@/lib/workspace/types";

/** Edit one task — title, notes, due date, priority, or whether it is done. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<TaskInput> | null;

  if (!body) {
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  }

  try {
    if (!updateTask(id, body)) {
      return Response.json({ error: "No such task." }, { status: 404 });
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
  if (!deleteTask(id)) {
    return Response.json({ error: "No such task." }, { status: 404 });
  }
  return Response.json(getWorkspace());
}
