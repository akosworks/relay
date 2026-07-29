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
    title: "Staff Engineer, Identity",
    team: "Platform",
    joined: "2023-02-06",
  },
  {
    handle: "@marcus",
    real_name: "Marcus Webb",
    title: "Product Manager",
    team: "Atlas",
    joined: "2024-01-15",
  },
  {
    handle: "@dana",
    real_name: "Dana Okafor",
    title: "Chief Technology Officer",
    team: "Leadership",
    joined: "2021-09-01",
  },
  {
    handle: "@sam",
    real_name: "Sam Lindqvist",
    title: "Design Lead",
    team: "Product Design",
    joined: "2023-11-20",
  },
  {
    handle: "@ines",
    real_name: "Ines Duarte",
    title: "Senior Backend Engineer",
    team: "Payments",
    joined: "2022-06-13",
  },
  {
    handle: "@theo",
    real_name: "Theo Novak",
    title: "Customer Success Manager",
    team: "Revenue",
    joined: "2024-04-08",
  },
  {
    handle: "@yuki",
    real_name: "Yuki Tanaka",
    title: "Infrastructure Engineer",
    team: "Platform",
    joined: "2022-10-03",
  },
];

const MESSAGES: SlackMessage[] = [
  {
    channel: "#eng-platform",
    ts: "2026-05-11T09:12:00Z",
    user: "Dana Okafor",
    text: "Reminder for anyone new: Priya Raman owns authentication and identity end to end. Anything touching login, sessions or SSO goes through her before it ships.",
  },
  {
    channel: "#eng-platform",
    ts: "2026-05-11T09:19:00Z",
    user: "Ines Duarte",
    text: "And I own the payments ledger for Project Atlas. Ping me before changing anything under services/ledger.",
  },
  {
    channel: "#eng-platform",
    ts: "2026-05-19T16:40:00Z",
    user: "Dana Okafor",
    text: "Recap of the architecture review: we decided to keep PostgreSQL as the system of record for Project Atlas because we need transactional guarantees on the ledger and the team already operates Postgres at scale. We are not moving to DynamoDB.",
    reactions: ["+1", "eyes"],
  },
  {
    channel: "#proj-atlas",
    ts: "2026-06-24T15:05:00Z",
    user: "Marcus Webb",
    text: "Planning meeting done. Project Atlas launch is targeted for 16 July. SAML SSO is a fast follow, not a launch blocker. Beacon kicks off next week.",
  },
  {
    channel: "#proj-atlas",
    ts: "2026-07-06T11:02:00Z",
    user: "Priya Raman",
    text: "Heads up: SAML SSO is turning out much harder than scoped. Every IdP handles metadata refresh differently and Okta and Entra disagree on signed logout. ATLAS-214 is going to slip past launch week.",
    thread: "2026-07-06T11:02:00Z",
  },
  {
    channel: "#proj-atlas",
    ts: "2026-07-06T11:31:00Z",
    user: "Theo Novak",
    text: "That is a problem. Vantage Health cannot start their rollout without SSO, it is a hard requirement from their security review.",
    thread: "2026-07-06T11:02:00Z",
  },
  {
    channel: "#proj-atlas",
    ts: "2026-07-06T11:48:00Z",
    user: "Marcus Webb",
    text: "So the Project Atlas launch depends on ATLAS-214 after all. Let's take it to the launch review on Friday rather than deciding in a thread.",
    thread: "2026-07-06T11:02:00Z",
  },
  {
    channel: "#general",
    ts: "2026-07-10T17:20:00Z",
    user: "Dana Okafor",
    text: "Company update: we have decided to delay the Project Atlas launch from 16 July to 13 August because SAML SSO will not be ready and Vantage Health cannot go live without it. Shipping twice would cost us more support load than waiting four weeks. Marcus Webb will send the revised launch plan.",
    reactions: ["heart", "+1", "raised_hands"],
  },
  {
    channel: "#proj-beacon",
    ts: "2026-07-01T10:15:00Z",
    user: "Sam Lindqvist",
    text: "Project Beacon kickoff. We are rebuilding customer onboarding end to end. The current process takes eleven days from signed contract to first successful transaction and most of that is waiting on manual account setup.",
  },
  {
    channel: "#proj-beacon",
    ts: "2026-07-14T09:44:00Z",
    user: "Sam Lindqvist",
    text: "Onboarding process doc is updated in Notion. Short version: contract signed, workspace provisioned automatically, kickoff call within two business days, sandbox credentials issued, guided first transaction, then a thirty day check in from customer success.",
  },
  {
    channel: "#eng-platform",
    ts: "2026-07-15T13:05:00Z",
    user: "Priya Raman",
    text: "Session cookie rotation is merged. Authentication now rotates the session token on privilege change, which was the last open item from the Vantage Health security review other than SSO itself.",
  },
  {
    channel: "#customer-vantage",
    ts: "2026-07-20T08:30:00Z",
    user: "Theo Novak",
    text: "Vantage Health confirmed they are comfortable with 13 August provided SSO lands. Kestrel Logistics is unaffected and still expects webhook retries fixed this month.",
  },
  {
    channel: "#proj-meridian",
    ts: "2026-07-21T14:12:00Z",
    user: "Yuki Tanaka",
    text: "Project Meridian beta is on Android 15 now. MER-77 crash on cold start is still open and it blocks the public beta.",
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
