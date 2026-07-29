import { createTask, getWorkspace, reorderTasks } from "@/lib/workspace/store";
import type { TaskInput } from "@/lib/workspace/types";

/**
 * Create a task, or rewrite the order of the list.
 *
 * Both return the whole workspace. Position is a property of the collection,
 * and so is every number the dashboard shows, so handing back one task would
 * make the client reconstruct state it cannot see.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as (TaskInput & { title?: string }) | null;

  if (!body || typeof body.title !== "string") {
    return Response.json({ error: "A task needs a title." }, { status: 400 });
  }

  try {
    createTask(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "That task could not be created." },
      { status: 400 },
    );
  }

  return Response.json(getWorkspace(), { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { order?: unknown } | null;
  const order = body?.order;

  if (!Array.isArray(order) || order.some((id) => typeof id !== "string")) {
    return Response.json({ error: "`order` must be a list of task ids." }, { status: 400 });
  }

  reorderTasks(order as string[]);
  return Response.json(getWorkspace());
}
