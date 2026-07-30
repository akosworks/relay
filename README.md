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

### Configure LLM extraction

If you want the extraction stage to use an LLM instead of the built-in rules,
set these environment variables before starting the app.

For Groq:

```bash
export GROQ_API_KEY=your-groq-key
export GROQ_MODEL=llama-3.3-70b-versatile
export GROQ_BASE_URL=https://api.groq.com/openai/v1
export RELAY_LLM_PROVIDER=groq
export RELAY_EXTRACTOR=llm
```

For OpenAI-compatible providers:

```bash
export OPENAI_API_KEY=your-key
export OPENAI_MODEL=gpt-4.1-mini
export OPENAI_BASE_URL=https://api.openai.com/v1
export RELAY_LLM_PROVIDER=openai
export RELAY_EXTRACTOR=llm
```

If no API key is present, Relay automatically falls back to the deterministic
rule-based extractor so the app still works locally.

Gmail and GitHub are already registered in the integrations list, so they will
appear on the Integrations page once the app is running.

### Connect a real GitHub account

GitHub is the one connector that can read a live account. Paste a personal
access token into `.env.local` — there is a marked block at the bottom of the
file — and that is the whole setup:

```bash
GITHUB_TOKEN=github_pat_...
```

Relay then reads **every repository the token can see**, most recently pushed
first, skipping archived ones. To narrow it to a few, set the optional list:

```bash
GITHUB_REPOS=acme/atlas,acme/meridian
```

Create the token at <https://github.com/settings/tokens> with read access to
**Issues**, **Pull requests** and **Contents**. A classic token needs the `repo`
scope; a fine-grained token must have *All repositories* selected for the
read-everything default to mean anything. Restart the dev server, then press
**Connect** on the GitHub card.

A configured token wins over the mock switch below — a source reading real data
never mixes fixtures into it. A repository that fails mid-sync (issues disabled,
access revoked) costs that repository only; a rejected token stops the sync and
says so.

Relay reads recent issues and pull requests per repository through the REST API,
maps them to the same `ConnectorEvent` shape the fixtures use, and hands them to
the same ingestion pipeline. Nothing downstream knows the difference.

### Mock data on and off

Every other connector reads fixtures. The switch is a constant in
[`lib/integrations/mode.ts`](lib/integrations/mode.ts):

```ts
const MOCK_DATA = true;   // false = real sources only
```

`RELAY_MOCK_DATA=off` in `.env.local` overrides it without editing code. With
mock data off, fixture-backed sources fetch nothing and contribute no memories;
a connector configured with real credentials keeps working. The rule is applied
in one place, `lib/integrations/source.ts`, so a new connector cannot forget it.

Changing the switch affects what future syncs read — it does not retroactively
remove memories already learned. Restart the dev server (memory lives in
process) or disconnect and reconnect the sources to rebuild from scratch.

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

- **Data.** Every connector except GitHub returns fixture records instead of
  calling an API. They are shaped like the real payloads and mapped through the
  same code a live connector would use. GitHub calls the real REST API when a
  token is configured — see above.
- **Extraction.** The extractor is deterministic rules over sentence shapes —
  decision cues, ownership statements, dependency phrases — rather than a model
  call, so the pipeline runs offline and repeatably.
- **Auth.** One hard-coded demo account, `fun@relay.com` / `iloverelay`, checked
  against a constant in `lib/auth.ts`. There is no user table and no hashing —
  the credentials are printed on the login screen, because this is a demo. The
  session is an `HttpOnly` cookie and the workspace routes are gated in
  `proxy.ts`, so the lock is real even though the key is public.

Memory lives in process. Restarting the dev server re-learns everything from the
connectors, which takes a few milliseconds.
