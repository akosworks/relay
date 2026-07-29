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
      "Status: accepted. We decided to keep PostgreSQL as the system of record for Project Atlas because the ledger requires multi row transactional guarantees and the team already operates Postgres at scale. DynamoDB was rejected because every proposed workaround reimplements two phase commit. Decided by Dana Okafor with Ines Duarte, Yuki Tanaka and Priya Raman. Revisit if sustained write volume passes fifty thousand per second.",
  },
  {
    id: "proc-onboarding",
    title: "Customer onboarding process",
    space: "Revenue",
    author: "Sam Lindqvist",
    editedAt: "2026-07-14T09:40:00Z",
    content:
      "This is how we onboard a new customer. Step one, the contract is signed and countersigned in the CLM. Step two, the workspace is provisioned automatically by the Atlas provisioning API, which replaced the manual setup that used to take eight days. Step three, customer success runs a kickoff call within two business days. Step four, sandbox credentials are issued to the customer's engineering contact. Step five, we run a guided first transaction with them in sandbox before production keys are released. Step six, a thirty day check in with customer success. Owner: Theo Novak. Project Beacon is the effort rebuilding this process, and it cut the end to end time from eleven days to three.",
  },
  {
    id: "runbook-incident",
    title: "Incident response runbook",
    space: "Engineering",
    author: "Yuki Tanaka",
    editedAt: "2026-06-02T11:00:00Z",
    content:
      "How we respond to a production incident. Declare in #incident with a severity. The on call engineer is the incident commander until they hand it over explicitly. Customer facing comms are written by customer success, never by engineering. A written postmortem is due within five working days and is blameless. Owner: Yuki Tanaka.",
  },
  {
    id: "spec-atlas-sso",
    title: "Atlas SSO specification",
    space: "Engineering",
    author: "Priya Raman",
    editedAt: "2026-07-02T16:20:00Z",
    content:
      "SAML SSO for Project Atlas. Supports Okta, Microsoft Entra and generic SAML 2.0 identity providers. Service provider initiated and identity provider initiated flows, just in time provisioning, and signed single logout. Open risk: identity provider metadata refresh is not standardised and Okta and Entra disagree on signed logout. This work is tracked as ATLAS-214 and is owned by Priya Raman. Vantage Health requires it before their rollout.",
  },
  {
    id: "brief-beacon",
    title: "Project Beacon brief",
    space: "Product",
    author: "Sam Lindqvist",
    editedAt: "2026-07-01T08:00:00Z",
    content:
      "Project Beacon rebuilds customer onboarding end to end. Goal: reduce time from signed contract to first successful transaction from eleven days to under three. Project Beacon depends on Project Atlas for the provisioning API. Owner: Sam Lindqvist. Customer success input from Theo Novak.",
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
