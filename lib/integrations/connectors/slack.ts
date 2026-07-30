import type { Connector, ConnectorEvent } from "../types";

/**
 * Slack. The vendor shape (channel, ts, user, thread_ts) stops here; everything
 * after this file sees a `ConnectorEvent`.
 */

type SlackMessage = {
  channel: string;
  ts: string;
  user: string;
  text: string;
  thread?: string;
  reactions?: string[];
};

type SlackMember = {
  handle: string;
  real_name: string;
  title: string;
  team: string;
  joined: string;
};

const MEMBERS: SlackMember[] = [
  {
    handle: "@priya",
    real_name: "Priya Raman",
    title: "Staff Engineer, Retrieval",
    team: "Memory",
    joined: "2025-02-06",
  },
  {
    handle: "@dana",
    real_name: "Dana Okafor",
    title: "Chief Technology Officer",
    team: "Leadership",
    joined: "2024-09-01",
  },
  {
    handle: "@ines",
    real_name: "Ines Duarte",
    title: "Senior Backend Engineer",
    team: "Memory",
    joined: "2024-06-13",
  },
  {
    handle: "@theo",
    real_name: "Theo Novak",
    title: "Customer Success Manager",
    team: "Revenue",
    joined: "2026-04-08",
  },
];

const MESSAGES: SlackMessage[] = [
  {
    channel: "#eng-memory",
    ts: "2026-05-11T09:12:00Z",
    user: "Dana Okafor",
    text: "Reminder for anyone new: Priya Raman owns retrieval and grounding end to end. Anything that changes how Relay ranks memories or attaches citations goes through her before it ships.",
  },
  {
    channel: "#eng-memory",
    ts: "2026-05-19T16:40:00Z",
    user: "Dana Okafor",
    text: "Recap of the architecture review: we decided to keep PostgreSQL as the system of record for the memory graph because entities and relationships need transactional merges. We are not moving to a vector-only store.",
    reactions: ["+1", "eyes"],
  },
  {
    channel: "#proj-harbour",
    ts: "2026-07-06T11:02:00Z",
    user: "Ines Duarte",
    text: "Heads up: persistence is harder than scoped. The memory graph lives in process, so every serverless instance starts empty. RELAY-214 is going to slip past beta week.",
    thread: "2026-07-06T11:02:00Z",
  },
  {
    channel: "#proj-harbour",
    ts: "2026-07-06T11:31:00Z",
    user: "Theo Novak",
    text: "That is a problem. Northwind Labs cannot start their pilot on an instance that forgets what it read.",
    thread: "2026-07-06T11:02:00Z",
  },
  {
    channel: "#general",
    ts: "2026-07-10T17:20:00Z",
    user: "Dana Okafor",
    text: "Company update: we have decided to delay the Relay public beta from 16 July to 13 August because persistent storage will not be ready and Northwind Labs cannot pilot without it. Shipping an agent that forgets would cost us more trust than waiting four weeks.",
    reactions: ["heart", "+1", "raised_hands"],
  },
  {
    channel: "#customer-northwind",
    ts: "2026-07-20T08:30:00Z",
    user: "Theo Novak",
    text: "Northwind Labs confirmed they are comfortable with 13 August provided persistence lands. Kestrel Logistics is unaffected.",
  },
];

function memberEvent(m: SlackMember): ConnectorEvent {
  return {
    sourceType: "slack.member",
    externalId: `member:${m.handle}`,
    title: m.real_name,
    body: `${m.real_name} (${m.handle}) is ${m.title} on the ${m.team} team.`,
    author: m.real_name,
    occurredAt: `${m.joined}T09:00:00Z`,
    url: `https://slack.com/team/${m.handle.slice(1)}`,
    metadata: { handle: m.handle, role: m.title, team: m.team },
  };
}

function messageEvent(m: SlackMessage): ConnectorEvent {
  return {
    sourceType: "slack.message",
    externalId: `${m.channel}:${m.ts}`,
    title: `${m.channel} — ${m.user}`,
    body: m.text,
    author: m.user,
    occurredAt: m.ts,
    url: `https://slack.com/archives/${m.channel.replace("#", "")}/${m.ts}`,
    metadata: {
      channel: m.channel,
      thread: m.thread ?? null,
      reactions: m.reactions ?? [],
    },
  };
}

export const slackConnector: Connector = {
  id: "slack",
  name: "Slack",
  blurb: "Channels, threads and the directory of who does what.",
  category: "communication",
  sourceTypes: ["slack.message", "slack.member"],
  teaches: ["person", "decision", "project", "issue", "customer"],
  async fetch({ since, limit } = {}) {
    const events = [...MEMBERS.map(memberEvent), ...MESSAGES.map(messageEvent)]
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
