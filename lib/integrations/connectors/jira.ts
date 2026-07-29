import type { Connector, ConnectorEvent } from "../types";

/** Jira. Tracked work, with status and assignee already structured. */

type JiraIssue = {
  key: string;
  summary: string;
  description: string;
  status: "To Do" | "In Progress" | "Blocked" | "Done";
  assignee: string;
  reporter: string;
  project: string;
  updatedAt: string;
  blockedBy?: string[];
};

const ISSUES: JiraIssue[] = [
  {
    key: "ATLAS-214",
    summary: "SAML SSO for enterprise customers",
    description:
      "Implement SAML 2.0 single sign on for Project Atlas covering Okta and Microsoft Entra. Blocked on identity provider metadata refresh and disagreement on signed logout. Required by Vantage Health before their rollout. This task blocks the Project Atlas launch.",
    status: "Blocked",
    assignee: "Priya Raman",
    reporter: "Marcus Webb",
    project: "Atlas",
    updatedAt: "2026-07-21T10:05:00Z",
  },
  {
    key: "ATLAS-238",
    summary: "Revised launch plan for 13 August",
    description:
      "Rewrite the Project Atlas launch plan for the new 13 August date agreed in the launch review. Assigned to Marcus Webb.",
    status: "In Progress",
    assignee: "Marcus Webb",
    reporter: "Dana Okafor",
    project: "Atlas",
    updatedAt: "2026-07-13T09:00:00Z",
  },
  {
    key: "ATLAS-241",
    summary: "Webhook retry backoff",
    description:
      "Webhook deliveries stop retrying after three failures, reported by Kestrel Logistics. Assigned to Ines Duarte.",
    status: "In Progress",
    assignee: "Ines Duarte",
    reporter: "Theo Novak",
    project: "Atlas",
    updatedAt: "2026-07-22T15:30:00Z",
  },
  {
    key: "ATLAS-190",
    summary: "Ledger idempotency keys",
    description: "Idempotent payment intents in the Atlas ledger. Delivered in atlas#476.",
    status: "Done",
    assignee: "Ines Duarte",
    reporter: "Ines Duarte",
    project: "Atlas",
    updatedAt: "2026-06-15T13:00:00Z",
  },
];

export const jiraConnector: Connector = {
  id: "jira",
  name: "Jira",
  blurb: "Tickets, status and assignment for tracked work.",
  category: "tickets",
  sourceTypes: ["jira.issue"],
  teaches: ["task", "issue", "project", "person"],
  async fetch({ since, limit } = {}) {
    const events: ConnectorEvent[] = ISSUES.map((i): ConnectorEvent => ({
      sourceType: "jira.issue",
      externalId: i.key,
      title: `${i.key} ${i.summary}`,
      body: `${i.description} Status: ${i.status}. Assigned to ${i.assignee}. Reported by ${i.reporter}.`,
      author: i.reporter,
      participants: [i.assignee, i.reporter],
      occurredAt: i.updatedAt,
      url: `https://jira.internal/browse/${i.key}`,
      metadata: {
        key: i.key,
        status: i.status,
        assignee: i.assignee,
        project: i.project,
      },
    }))
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
