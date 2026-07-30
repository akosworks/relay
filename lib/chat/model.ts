import { getLlmConfig } from "@/lib/extraction/llm";

/**
 * The chat model, with tools.
 *
 * Thin on purpose: one request, one response, no loop. The loop belongs to the
 * agent, because deciding when to stop calling tools is a product decision
 * about how hard to work before admitting memory has nothing — not a transport
 * concern.
 */

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ModelReply = {
  content: string | null;
  toolCalls: ToolCall[];
};

export function isModelConfigured(): boolean {
  return getLlmConfig() !== null;
}

function sanitizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/** Longest a single rate-limit wait is worth taking before giving up. */
const MAX_RETRY_WAIT_MS = 12_000;
const MAX_ATTEMPTS = 3;

/**
 * How long the provider says to wait. Groq puts it in `retry-after`, and again
 * more precisely in the message body ("try again in 8.93s").
 */
function retryDelay(response: Response, body: string): number | null {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;

  const stated = body.match(/try again in ([\d.]+)(?:m([\d.]+))?s/i);
  if (stated) {
    const minutes = stated[2] ? Number(stated[1]) : 0;
    const seconds = stated[2] ? Number(stated[2]) : Number(stated[1]);
    return (minutes * 60 + seconds) * 1000;
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runChat(
  messages: ChatMessage[],
  tools?: ToolSchema[],
): Promise<ModelReply | null> {
  const config = getLlmConfig();
  if (!config) return null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${sanitizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        messages,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      }),
    });

    if (response.ok) {
      const data = (await response.json().catch(() => null)) as {
        choices?: Array<{
          message?: { content?: string | null; tool_calls?: ToolCall[] };
        }>;
      } | null;

      const message = data?.choices?.[0]?.message;
      if (!message) return null;

      return {
        content: typeof message.content === "string" ? message.content : null,
        toolCalls: message.tool_calls ?? [],
      };
    }

    const detail = (await response.text().catch(() => "")).slice(0, 600);

    // A per-minute quota clears on its own, and waiting a few seconds beats
    // going silent — which from the outside is indistinguishable from memory
    // holding nothing, a different and much worse claim.
    const wait = response.status === 429 ? retryDelay(response, detail) : null;
    if (wait !== null && wait <= MAX_RETRY_WAIT_MS && attempt < MAX_ATTEMPTS) {
      await sleep(wait + 250);
      continue;
    }

    console.error(`[relay] chat model ${response.status} (attempt ${attempt}):`, detail);
    return null;
  }

  return null;
}
