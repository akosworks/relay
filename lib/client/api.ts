import type { ChatAnswer, ChatTurn } from "@/lib/chat/types";
import type { SyncReport } from "@/lib/ingestion/pipeline";
import type { IntegrationSummary } from "@/lib/integrations/types";
import type { MemoryOverview } from "@/lib/memory/overview";
import type { EntityDetail } from "@/lib/memory/types";

/**
 * The only place the UI knows about HTTP.
 *
 * Components take data and callbacks; nothing in `components/` imports a
 * service, a store or a route path.
 */

async function json<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function askQuestion(question: string, history: ChatTurn[] = []): Promise<ChatAnswer> {
  return json<ChatAnswer>("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
}

export function fetchOverview(): Promise<MemoryOverview> {
  return json<MemoryOverview>("/api/memory");
}

export function fetchEntity(id: string): Promise<EntityDetail> {
  return json<EntityDetail>(`/api/memory/${id}`);
}

export function fetchIntegrations(): Promise<{ integrations: IntegrationSummary[] }> {
  return json<{ integrations: IntegrationSummary[] }>("/api/integrations");
}

export function runIntegrationAction(
  id: string,
  action: "connect" | "disconnect" | "sync",
): Promise<{ integration: IntegrationSummary; report: SyncReport | null }> {
  return json(`/api/integrations/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
}
