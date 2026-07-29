import type { Connector, ConnectorEvent } from "../types";

/** Linear. Product and design work for Beacon and Meridian. */

type LinearIssue = {
  identifier: string;
  title: string;
  description: string;
  state: "Backlog" | "In Progress" | "Blocked" | "Done";
  assignee: string;
  team: string;
  updatedAt: string;
};

const ISSUES: LinearIssue[] = [
  {
    identifier: "BEACON-32",
    title: "Automated workspace provisioning",
    description:
      "Provision a customer workspace automatically when a contract is countersigned, replacing the manual setup in the onboarding process. Depends on the Project Atlas provisioning API. Assigned to Sam Lindqvist.",
    state: "In Progress",
    assignee: "Sam Lindqvist",
    team: "Beacon",
    updatedAt: "2026-07-17T11:20:00Z",
  },
  {
    identifier: "BEACON-41",
    title: "Guided first transaction in sandbox",
    description:
      "Walk a new customer through their first sandbox transaction as step five of the onboarding process. Assigned to Sam Lindqvist.",
    state: "Backlog",
    assignee: "Sam Lindqvist",
    team: "Beacon",
    updatedAt: "2026-07-19T09:00:00Z",
  },
  {
    identifier: "MER-77",
    title: "Cold start crash on Android 15",
    description:
      "Project Meridian crashes on cold start when the cached session is restored early. This issue blocks the Project Meridian public beta. Assigned to Yuki Tanaka.",
    state: "In Progress",
    assignee: "Yuki Tanaka",
    team: "Meridian",
    updatedAt: "2026-07-22T09:10:00Z",
  },
];

export const linearConnector: Connector = {
  id: "linear",
  name: "Linear",
  blurb: "Product and design issues across Beacon and Meridian.",
  category: "tickets",
  sourceTypes: ["linear.issue"],
  teaches: ["task", "issue", "project", "person"],
  async fetch({ since, limit } = {}) {
    const events: ConnectorEvent[] = ISSUES.map((i): ConnectorEvent => ({
      sourceType: "linear.issue",
      externalId: i.identifier,
      title: `${i.identifier} ${i.title}`,
      body: `${i.description} Status: ${i.state}.`,
      author: i.assignee,
      participants: [i.assignee],
      occurredAt: i.updatedAt,
      url: `https://linear.app/acme/issue/${i.identifier}`,
      metadata: { identifier: i.identifier, state: i.state, team: i.team, assignee: i.assignee },
    }))
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
