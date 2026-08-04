import {
  ENTITY_TYPES,
  RELATION_TYPES,
  type ExtractionResult,
  type RawEvent,
} from "@/lib/memory/types";
import { heuristicExtractor } from "./heuristic";
import type { ExtractionContext, Extractor } from "./types";

type LlmProvider = "openai" | "groq";

type LlmConfig = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
};

export function getLlmConfig(): LlmConfig | null {
  const requested = (process.env.RELAY_LLM_PROVIDER ?? "").trim().toLowerCase();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (requested === "groq" && groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      baseUrl: process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1",
      temperature: Number(process.env.GROQ_TEMPERATURE ?? process.env.OPENAI_TEMPERATURE ?? 0.1),
    };
  }

  if (requested === "openai" && openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.1),
    };
  }

  if (groqKey) {
    return {
      provider: "groq",
      apiKey: groqKey,
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      baseUrl: process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1",
      temperature: Number(process.env.GROQ_TEMPERATURE ?? process.env.OPENAI_TEMPERATURE ?? 0.1),
    };
  }

  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      temperature: Number(process.env.OPENAI_TEMPERATURE ?? 0.1),
    };
  }

  return null;
}

function sanitizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function parseJsonPayload(raw: string): ExtractionResult | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.entities) && Array.isArray(parsed.relationships)) {
      return parsed as ExtractionResult;
    }
  } catch {
    // Fall back to heuristic extraction below.
  }

  return null;
}

function buildPrompt(event: RawEvent): string {
  return [
    "You are extracting organizational memory from a single raw event.",
    "Return strict JSON with two top-level arrays: entities and relationships.",
    `Entity type must be one of: ${ENTITY_TYPES.join(", ")}.`,
    "Each entity must include: type, title, summary, confidence, excerpt, and optional keyHint, attributes, occurredAt, tags.",
    `Relationship type must be one of: ${RELATION_TYPES.join(", ")}.`,
    "Each relationship must include: type, from, to, confidence, excerpt, and optional note.",
    "from and to must each be an object with type and title matching an entity you returned.",
    "Use a confidence between 0 and 1.",
    "Keep the output compact and grounded in the event text.",
    "",
    // The structural facts are extracted separately and reliably; asking the
    // model for them again wastes the request and invites a worse version of
    // something already known.
    "Do not restate the obvious identity of the event itself (that a commit is a",
    "commit, or a repository is a repository). Extract what the TEXT says: the",
    "decisions, ownership, dependencies, status and people it describes.",
    "Return empty arrays if the text carries none of that.",
    "",
    `Event kind: ${event.sourceType}`,
    "",
    "Event title:",
    event.title,
    "",
    "Event body:",
    event.body,
    "",
    "Event metadata:",
    JSON.stringify(event.metadata),
  ].join("\n");
}

async function callLlm(event: RawEvent): Promise<ExtractionResult | null> {
  const config = getLlmConfig();
  if (!config) return null;

  const url = `${sanitizeBaseUrl(config.baseUrl)}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      response_format: { type: "json_object" },
      // Same reasoning-model leak as the chat model: a <think> block ahead of
      // the JSON breaks parseJsonPayload, so this call silently falls back to
      // heuristic-only extraction — the model still reasons, this only keeps
      // the leak out of content.
      ...(config.provider === "groq" ? { reasoning_format: "hidden" } : {}),
      messages: [
        {
          role: "system",
          content:
            "You extract structured organizational memory from text. Output only valid JSON.",
        },  
        {
          role: "user",
          content: buildPrompt(event),
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? parseJsonPayload(content) : null;
}

function normalizeResult(result: ExtractionResult): ExtractionResult {
  return {
    entities: result.entities.map((entity) => ({
      ...entity,
      confidence: Math.min(1, Math.max(0, entity.confidence ?? 0.6)),
      excerpt: entity.excerpt ?? "",
      attributes: entity.attributes ?? {},
      tags: entity.tags ?? [],
    })),
    relationships: result.relationships.map((relationship) => ({
      ...relationship,
      confidence: Math.min(1, Math.max(0, relationship.confidence ?? 0.5)),
      excerpt: relationship.excerpt ?? "",
    })),
  };
}

export const llmExtractor: Extractor = {
  id: "llm",
  label: "LLM extractor",
  description:
    "Uses an OpenAI-compatible LLM API for extraction when a key is configured, including Groq, otherwise it falls back to the built-in rules.",
  /**
   * Rules first, model second, both kept.
   *
   * The structural pass asserts what the connector already knows for certain —
   * this event is a repository, that one is a commit and who wrote it. Handing
   * those to a model would turn facts into guesses, which is how a synced
   * repository ends up remembered as a stray sentence from its own README.
   * The model's job is the part rules cannot do: reading prose for decisions,
   * ownership and dependencies. Merging is safe because memory dedupes on
   * entity key, so the two passes reinforce rather than duplicate.
   */
  async extract(event: RawEvent, ctx: ExtractionContext) {
    const structural = await heuristicExtractor.extract(event, ctx);

    try {
      const result = await callLlm(event);
      if (result) {
        const inferred = normalizeResult(result);
        return {
          entities: [...structural.entities, ...inferred.entities],
          relationships: [...structural.relationships, ...inferred.relationships],
        };
      }
    } catch {
      // The rules already produced everything that is certain; the model's
      // contribution is additive, so losing it degrades the answer rather
      // than breaking the sync.
    }

    return structural;
  },
};
