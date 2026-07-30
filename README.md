# Relay

Relay is an AI-powered organizational memory that connects to the tools a company already uses, transforms their data into structured knowledge, and answers questions with verifiable evidence. Rather than searching through documents, chats, and tickets independently, Relay builds a unified memory graph that enables users to retrieve organizational knowledge through natural language.

---

## Technology Stack

* **Frontend:** Next.js, React, TypeScript
* **Backend:** Next.js API Routes
* **AI:** Rule-based extraction with optional LLM-powered extraction (Groq or OpenAI-compatible providers)
* **Integrations:** GitHub, Slack, Notion, Gmail, Google Drive, Google Docs, Jira, Linear
* **Deployment:** Compatible with modern Node.js hosting platforms such as Render and Vercel (persistent storage recommended for production deployments)

---

## Running Relay

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

The application will be available locally once the development server has started.

---

## Demo Login

Use the following credentials to access the demo:

**Email**

```
fun@relay.com
```

**Password**

```
iloverelay
```

---

## Pages

* **/** — Landing page
* **/chat** — AI workspace
* **/integrations** — Connect and manage data sources

---

## Current Integrations

Relay currently supports the following integrations:

* GitHub
* Slack
* Notion
* Gmail
* Google Drive
* Google Docs
* Jira
* Linear

At present:

* **GitHub** supports live data through a Personal Access Token.
* **All other integrations** currently use representative mock data to demonstrate the product experience.

---

## Connecting GitHub

Create a GitHub Personal Access Token with read access to repositories, issues, pull requests, and contents.

Add the following to `.env.local`:

```bash
GITHUB_TOKEN=github_pat_...
```

Optionally limit synchronization to selected repositories:

```bash
GITHUB_REPOS=owner/repository,owner/another-repository
```

After restarting the application, connect GitHub from the **Integrations** page to begin importing repository data.

---

## AI Extraction

Relay works out of the box using its built-in extraction engine, to enable LLM-powered extraction, configure either a Groq or OpenAI-compatible provider.

### Groq

```bash
GROQ_API_KEY=your-key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_BASE_URL=https://api.groq.com/openai/v1
RELAY_LLM_PROVIDER=groq
RELAY_EXTRACTOR=llm
```

### OpenAI-Compatible

```bash
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
RELAY_LLM_PROVIDER=openai
RELAY_EXTRACTOR=llm
```

---

## Example Questions

Relay is designed to answer questions about an organization's knowledge, decisions, projects, and engineering work.

Examples include:

* Why was our launch delayed?
* What decisions were made during the planning meeting?
* Which pull requests are still awaiting review?
* What is the status of Project Atlas?
* Who owns the authentication service?
* What blockers are currently affecting the mobile team?
* Summarize recent engineering activity.
* What action items came out of last week's meeting?
* Which repositories have the most open issues?
* Explain why a particular decision was made.

Every response is grounded in evidence retrieved from connected sources.

---

## How It Works

Relay continuously ingests information from connected sources, extracts structured knowledge, builds an organizational memory graph, and retrieves relevant evidence to answer user questions.

```
Connectors
      ↓
Raw Events
      ↓
Knowledge Extraction
      ↓
Organizational Memory
      ↓
Retrieval
      ↓
AI Responses with Evidence
```

---

## Project Structure

| Module              | Responsibility              |
| ------------------- | --------------------------- |
| `lib/integrations/` | External data connectors    |
| `lib/ingestion/`    | Data ingestion pipeline     |
| `lib/extraction/`   | Knowledge extraction        |
| `lib/memory/`       | Organizational memory graph |
| `lib/storage/`      | Storage abstraction         |
| `lib/retrieval/`    | Evidence retrieval          |
| `lib/chat/`         | AI response generation      |

The architecture is modular, allowing connectors, storage providers, and extraction engines to be extended independently.
