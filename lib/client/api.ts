import type { Agenda } from "@/lib/agenda";
import type { ChatAnswer, ChatTurn } from "@/lib/chat/types";
import type { SyncReport } from "@/lib/ingestion/pipeline";
import type { IntegrationSummary, PlannedIntegration } from "@/lib/integrations/types";
import type { MemoryOverview } from "@/lib/memory/overview";
import type { EntityDetail } from "@/lib/memory/types";
import type { Board } from "@/lib/tasks/board";
import type { EventInput, TaskInput, Workspace } from "@/lib/workspace/types";

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

export function fetchAgenda(): Promise<Agenda> {
  return json<Agenda>("/api/agenda");
}

/** Work still open in the user's tools, read out of memory. Not their own list. */
export function fetchBoard(): Promise<Board> {
  return json<Board>("/api/work");
}

export function setWorkDone(id: string, done: boolean): Promise<Board> {
  return json<Board>(`/api/work/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ done }),
  });
}

// --------------------------------------------------------------- workspace

const send = <T>(url: string, method: string, body?: unknown): Promise<T> =>
  json<T>(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/**
 * The user's own tasks and events.
 *
 * Every mutation resolves to the whole workspace, so the caller replaces its
 * state with one authoritative object instead of patching a copy and hoping the
 * two stay in step.
 */
export function fetchWorkspace(): Promise<Workspace> {
  return json<Workspace>("/api/workspace");
}

export function createTask(input: TaskInput): Promise<Workspace> {
  return send<Workspace>("/api/workspace/tasks", "POST", input);
}

export function updateTask(id: string, patch: Partial<TaskInput>): Promise<Workspace> {
  return send<Workspace>(`/api/workspace/tasks/${id}`, "PATCH", patch);
}

export function deleteTask(id: string): Promise<Workspace> {
  return send<Workspace>(`/api/workspace/tasks/${id}`, "DELETE");
}

export function reorderTasks(order: string[]): Promise<Workspace> {
  return send<Workspace>("/api/workspace/tasks", "PATCH", { order });
}

export function createEvent(input: EventInput): Promise<Workspace> {
  return send<Workspace>("/api/workspace/events", "POST", input);
}

export function updateEvent(id: string, patch: Partial<EventInput>): Promise<Workspace> {
  return send<Workspace>(`/api/workspace/events/${id}`, "PATCH", patch);
}

export function deleteEvent(id: string): Promise<Workspace> {
  return send<Workspace>(`/api/workspace/events/${id}`, "DELETE");
}

export function fetchIntegrations(): Promise<{
  integrations: IntegrationSummary[];
  planned: PlannedIntegration[];
}> {
  return json("/api/integrations");
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
