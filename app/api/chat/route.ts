import { ask } from "@/lib/chat/agent";
import { ensureBootstrapped } from "@/lib/ingestion/bootstrap";

/** The one endpoint the product is about: a question in, a grounded answer out. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    question?: string;
    history?: { role: "user" | "agent"; content: string }[];
  } | null;

  const question = body?.question?.trim();
  if (!question) {
    return Response.json({ error: "A question is required." }, { status: 400 });
  }

  await ensureBootstrapped();
  const answer = await ask(question, body?.history ?? []);
  return Response.json(answer);
}