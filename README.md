# Relay

An AI agent that becomes an organization's memory. It reads the tools a company
already uses, turns what it finds into structured memory, and answers questions
about the company with the evidence attached.

```bash
npm run dev
```

- `/` — the marketing site
- `/chat` — the agent (the product)
- `/integrations` — sources to connect

Memory seeds itself on the first request: Slack, meeting transcripts, Notion and
GitHub are connected out of the box, so there is something to ask about
immediately. Connect Jira, Linear, Gmail, Google Docs or Drive to watch the
memory grow.

## What it does

Ask "why was our launch delayed" and the agent does not search documents. It
retrieves the **decision** memory, walks the graph to the meeting it was made
in, the person who made it, and the ticket it was waiting on, then writes an
answer where every sentence is numbered against the Slack message or transcript
turn that supports it.

If memory has nothing on a subject, it says so. That is enforced in retrieval,
not in prompt wording: a memory the question never reached cannot become an
answer.

## Pipeline

```
Connector → raw event storage → extraction → memory (entities + relationships) → retrieval → agent
```

Each stage is a module with one job, behind an interface:

| Module | Path | Responsibility |
| --- | --- | --- |
| Connectors | `lib/integrations/` | Vendor-shaped fetching. One file per source. |
| Ingestion | `lib/ingestion/` | Store raw, extract, merge, report. Idempotent. |
| Extraction | `lib/extraction/` | Raw text → structured JSON with confidence and citations. |
| Memory | `lib/memory/` | Entity and relationship model, identity, merging. |
| Storage | `lib/storage/` | `RawEventStore` and `MemoryStore` interfaces. |
| Retrieval | `lib/retrieval/` | Intent, ranking, graph expansion, evidence assembly. |
| Agent | `lib/chat/` | Answer composition. Cannot write an uncited sentence. |

Nothing above storage knows the store is in memory; nothing above extraction
knows the extractor is rule-based; nothing in `components/` imports a service.

## Extending it

**A new source** — add `lib/integrations/connectors/<vendor>.ts` exporting a
`Connector`, then add it to the array in `registry.ts`. Nothing else changes.

**A different extractor** — implement `Extractor` (in `lib/extraction/types.ts`)
and register it in `lib/extraction/index.ts`. A model-backed extractor returns
the same `ExtractionResult`, so ingestion, memory, retrieval and chat are
untouched.

**Real storage** — implement `RawEventStore` and `MemoryStore` and return the
new provider from `getStorage()`. Postgres for entities and edges, a vector
index for retrieval's first signal, everything else the same.

## What this build fakes

- **Data.** Every connector returns fixture records instead of calling an API.
  They are shaped like the real payloads and mapped through the same code a live
  connector would use.
- **Extraction.** The extractor is deterministic rules over sentence shapes —
  decision cues, ownership statements, dependency phrases — rather than a model
  call, so the pipeline runs offline and repeatably.
- **Auth.** Signing in is a door, not a check.

Memory lives in process. Restarting the dev server re-learns everything from the
connectors, which takes a few milliseconds.
