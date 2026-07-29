import { createEvent, getWorkspace } from "@/lib/workspace/store";
import type { EventInput } from "@/lib/workspace/types";

/** Put something on the calendar. No integration required, and none involved. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as EventInput | null;

  if (!body || typeof body.title !== "string" || typeof body.date !== "string") {
    return Response.json({ error: "An event needs a title and a date." }, { status: 400 });
  }

  try {
    createEvent(body);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "That event could not be created." },
      { status: 400 },
    );
  }

  return Response.json(getWorkspace(), { status: 201 });
}
