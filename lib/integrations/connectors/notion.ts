import type { Connector, ConnectorEvent } from "../types";

/** Notion. Long-lived written knowledge: procedures, runbooks, decision records. */

type NotionPage = {
  id: string;
  title: string;
  space: string;
  author: string;
  editedAt: string;
  content: string;
};

const PAGES: NotionPage[] = [
  {
    id: "adr-014",
    title: "ADR 014: PostgreSQL as the system of record",
    space: "Engineering",
    author: "Dana Okafor",
    editedAt: "2026-05-20T09:30:00Z",
    content:
      "Status: accepted. We decided to keep PostgreSQL as the system of record for the Relay memory graph because entities and relationships are merged transactionally on every sync. A vector-only store was rejected because embeddings cannot express an edge. Decided by Dana Okafor with Ines Duarte and Priya Raman.",
  },
  {
    id: "proc-connector",
    title: "Connector onboarding process",
    space: "Engineering",
    author: "Priya Raman",
    editedAt: "2026-07-14T09:40:00Z",
    content:
      "This is how we add a new source to Relay. Step one, write the connector file under lib/integrations/connectors. Step two, map the vendor payload to a ConnectorEvent and nothing else. Step three, register it in the registry. Step four, run a full sync against a real account. Step five, read what memory actually learned before shipping it. Owner: Priya Raman. Project Quarry is the effort making connectors two-way.",
  },
  {
    id: "spec-harbour",
    title: "Project Harbour specification",
    space: "Engineering",
    author: "Ines Duarte",
    editedAt: "2026-07-02T16:20:00Z",
    content:
      "Project Harbour makes Relay's memory survive a restart. Postgres behind the existing MemoryStore and RawEventStore interfaces, so nothing above storage changes. Open risk: the in-process cache is assumed by the bootstrap path. This work is tracked as RELAY-214 and is owned by Ines Duarte. Northwind Labs requires it before their pilot.",
  },
];

export const notionConnector: Connector = {
  id: "notion",
  name: "Notion",
  blurb: "Specs, briefs, runbooks and decision records.",
  category: "documents",
  sourceTypes: ["notion.page"],
  teaches: ["procedure", "decision", "project", "document", "feature"],
  async fetch({ since, limit } = {}) {
    const events: ConnectorEvent[] = PAGES.map((p): ConnectorEvent => ({
      sourceType: "notion.page",
      externalId: p.id,
      title: p.title,
      body: p.content,
      author: p.author,
      occurredAt: p.editedAt,
      url: `https://notion.so/${p.id}`,
      metadata: { space: p.space, author: p.author },
    }))
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
