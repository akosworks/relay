import { connectIntegration, syncIntegration } from "@/lib/ingestion/pipeline";
import { isMockEnabled } from "@/lib/integrations/mode";
import { getConnector, listConnectors } from "@/lib/integrations/registry";
import { isSourceSilent } from "@/lib/integrations/source";
import { listIntegrationSummaries } from "@/lib/integrations/state";
import { retrieve } from "@/lib/retrieval";
import type { Context } from "./context";
import type { ToolSchema } from "./model";

/**
 * What the agent can do besides talk.
 *
 * Three tools, and the shape of them is the point: the agent can look harder
 * (`search_memory`), find out what it is working with (`list_sources`), and go
 * get more (`sync_source`). None of them lets it produce a fact — every path to
 * a claim still runs through retrieval, so widening its abilities cannot widen
 * what it is able to make up.
 */

export const TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "search_memory",
      description:
        "Search Relay's memory graph for entities and relationships matching a query. " +
        "Use this when the first context block did not contain what you need, or to " +
        "look up a different subject named in the question. Returns memories with " +
        "numbered sources you must cite.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "What to look for. Use the organization's own words — a project, person, " +
              "repository, feature or ticket name — rather than a full sentence.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_sources",
      description:
        "List every connected source, whether it reads a real account or fixtures, " +
        "when it last synced, and how many events and memories it has contributed. " +
        "Use this when memory is empty or stale, to find out which source should be " +
        "synced before answering.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "sync_source",
      description:
        "Pull the latest data from one source into memory, then search memory again. " +
        "Use this when memory has nothing on a subject that a connected source would " +
        "plausibly know about — for example a question about a GitHub repository when " +
        "the GitHub source has few or no events. Syncing is safe and idempotent, but " +
        "it is slow: sync at most one source per answer, and only when it is likely " +
        "to help.",
      parameters: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "The source id, exactly as returned by list_sources.",
          },
        },
        required: ["source"],
      },
    },
  },
];

/** A tool result is text the model reads. Errors are results too, not exceptions. */
export type ToolOutcome = { text: string; retrieved: boolean };

async function runSearch(context: Context, query: string): Promise<ToolOutcome> {
  const result = await retrieve(query);
  return {
    text: context.absorb(result, `MEMORY SEARCH — "${query}"`),
    retrieved: result.memories.length > 0,
  };
}

function describeSources(): string {
  const summaries = listIntegrationSummaries();
  const lines = summaries.map((s) => {
    const connector = getConnector(s.id);
    const reading = s.live
      ? "reading a real account"
      : connector && isSourceSilent(connector)
        ? "fixtures only, and mock data is OFF so it reads nothing"
        : "reading fixtures";
    return `- ${s.id} (${s.name}) · ${s.status} · ${reading} · ${s.events} events · ${s.memories} memories · last synced ${s.lastSyncAt ?? "never"}`;
  });

  return [
    `SOURCES (mock data is ${isMockEnabled() ? "ON" : "OFF"}):`,
    ...lines,
    "",
    "A source with 0 events has contributed nothing to memory. Syncing it will only",
    "help if the source itself actually holds the data — an empty repository stays",
    "empty after a sync.",
  ].join("\n");
}

async function runSync(context: Context, id: string, question: string): Promise<ToolOutcome> {
  const connector = getConnector(id);
  if (!connector) {
    return {
      text: `No source called "${id}". Call list_sources for the valid ids.`,
      retrieved: false,
    };
  }

  if (isSourceSilent(connector)) {
    return {
      text:
        `${connector.name} has no real credentials configured and mock data is off, ` +
        `so a sync would read nothing. Do not retry it.`,
      retrieved: false,
    };
  }

  let report;
  try {
    report = await connectIntegration(id).catch(() => syncIntegration(id));
  } catch (error) {
    return {
      text: `Sync of ${connector.name} failed: ${
        error instanceof Error ? error.message : "unknown error"
      }. Answer from what memory already holds, and say the sync failed.`,
      retrieved: false,
    };
  }

  // A sync is only useful insofar as it changed what the question can reach, so
  // the tool answers with fresh retrieval rather than with a row of counters.
  const search = await runSearch(context, question);
  const summary =
    `SYNC — ${connector.name}: read ${report.eventsStored} new events, ` +
    `learned ${report.entitiesCreated} memories and ${report.relationships} links.` +
    (report.eventsStored === 0
      ? " The source had nothing new. Do not sync it again; say plainly that it holds nothing on this."
      : "");

  return { text: `${summary}\n\n${search.text}`, retrieved: search.retrieved };
}

export async function runTool(
  name: string,
  rawArgs: string,
  context: Context,
  question: string,
): Promise<ToolOutcome> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { text: `Could not parse the arguments to ${name}. Send valid JSON.`, retrieved: false };
  }

  switch (name) {
    case "search_memory": {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) return { text: "search_memory needs a non-empty query.", retrieved: false };
      return runSearch(context, query);
    }
    case "list_sources":
      return { text: describeSources(), retrieved: false };
    case "sync_source": {
      const source = typeof args.source === "string" ? args.source.trim() : "";
      if (!source) {
        return {
          text: `sync_source needs a source id. Valid ids: ${listConnectors()
            .map((c) => c.id)
            .join(", ")}.`,
          retrieved: false,
        };
      }
      return runSync(context, source, question);
    }
    default:
      return { text: `No tool called ${name}.`, retrieved: false };
  }
}
