import type { Connector, ConnectorEvent } from "../types";

/**
 * Meeting transcripts. The richest source of decisions, because meetings are
 * where reasoning is said out loud and then never written down anywhere else.
 */

type Transcript = {
  id: string;
  title: string;
  startedAt: string;
  durationMinutes: number;
  attendees: string[];
  turns: { speaker: string; text: string }[];
};

const TRANSCRIPTS: Transcript[] = [
  {
    id: "mtg-2026-05-19-architecture",
    title: "Architecture review: Atlas data layer",
    startedAt: "2026-05-19T15:00:00Z",
    durationMinutes: 50,
    attendees: ["Dana Okafor", "Ines Duarte", "Yuki Tanaka", "Priya Raman"],
    turns: [
      {
        speaker: "Yuki Tanaka",
        text: "The question on the table is whether the Atlas ledger stays on PostgreSQL or moves to DynamoDB before launch.",
      },
      {
        speaker: "Ines Duarte",
        text: "The ledger needs multi row transactions. Every workaround we sketched for DynamoDB reinvents two phase commit badly.",
      },
      {
        speaker: "Dana Okafor",
        text: "Then we decided to keep PostgreSQL as the system of record for Project Atlas, because we need transactional guarantees and we already run Postgres at scale. We revisit it only if write volume passes fifty thousand a second.",
      },
      {
        speaker: "Priya Raman",
        text: "That also keeps identity simple, sessions and the ledger stay in one database.",
      },
    ],
  },
  {
    id: "mtg-2026-06-24-planning",
    title: "Q3 planning meeting",
    startedAt: "2026-06-24T13:00:00Z",
    durationMinutes: 75,
    attendees: [
      "Dana Okafor",
      "Marcus Webb",
      "Priya Raman",
      "Sam Lindqvist",
      "Ines Duarte",
      "Theo Novak",
    ],
    turns: [
      {
        speaker: "Marcus Webb",
        text: "Project Atlas launch is targeted for 16 July. Everything in the launch plan is either done or in review.",
      },
      {
        speaker: "Priya Raman",
        text: "SAML SSO is the one piece I am not confident about. I have it scoped at three weeks but I have not built against Entra before.",
      },
      {
        speaker: "Dana Okafor",
        text: "We agreed to treat SAML SSO as a fast follow rather than a launch blocker, so a slip there does not move the date.",
      },
      {
        speaker: "Sam Lindqvist",
        text: "Project Beacon kicks off next week. The goal is to cut customer onboarding from eleven days to under three.",
      },
      {
        speaker: "Theo Novak",
        text: "Vantage Health signs in August and Kestrel Logistics renews in September, both are counted on for the Q3 number.",
      },
    ],
  },
  {
    id: "mtg-2026-07-10-launch-review",
    title: "Atlas launch review",
    startedAt: "2026-07-10T15:00:00Z",
    durationMinutes: 45,
    attendees: ["Dana Okafor", "Marcus Webb", "Priya Raman", "Theo Novak"],
    turns: [
      {
        speaker: "Marcus Webb",
        text: "We are here because SAML SSO is not going to be ready for 16 July and Theo says that changes what the date means.",
      },
      {
        speaker: "Priya Raman",
        text: "ATLAS-214 is genuinely blocked on IdP metadata refresh. Okta and Entra disagree on signed logout and I need a working Entra tenant to test against. Realistically it is four more weeks.",
      },
      {
        speaker: "Theo Novak",
        text: "Vantage Health cannot go live without SSO. It came out of their security review and it is a hard contractual requirement, not a preference.",
      },
      {
        speaker: "Marcus Webb",
        text: "We could launch on time without them and onboard Vantage Health later, but that means running the onboarding twice.",
      },
      {
        speaker: "Dana Okafor",
        text: "We have decided to delay the Project Atlas launch to 13 August because SAML SSO will not be ready and Vantage Health cannot go live without it. Launching twice costs more support load than waiting four weeks. Marcus Webb owns the revised launch plan and Priya Raman keeps SSO as her only priority until it ships.",
      },
      {
        speaker: "Dana Okafor",
        text: "This supersedes the planning meeting call that SAML SSO was a fast follow. It is a launch blocker now.",
      },
      {
        speaker: "Theo Novak",
        text: "I will tell Vantage Health today and confirm the new date with them.",
      },
    ],
  },
  {
    id: "mtg-2026-07-16-beacon-design",
    title: "Beacon onboarding walkthrough",
    startedAt: "2026-07-16T10:00:00Z",
    durationMinutes: 40,
    attendees: ["Sam Lindqvist", "Theo Novak", "Marcus Webb"],
    turns: [
      {
        speaker: "Sam Lindqvist",
        text: "The onboarding process after Beacon is six steps: contract signed, workspace provisioned automatically, kickoff call within two business days, sandbox credentials issued, a guided first transaction, then a thirty day check in.",
      },
      {
        speaker: "Theo Novak",
        text: "The manual account setup was the eight day tail. Automating provisioning is what takes it from eleven days to three.",
      },
      {
        speaker: "Marcus Webb",
        text: "Project Beacon depends on Project Atlas for the provisioning API, so Beacon cannot finish before Atlas launches.",
      },
    ],
  },
];

/**
 * Each turn becomes its own event. Extraction works on statements, and a
 * fifty minute meeting collapsed into one blob buries the one sentence that
 * actually decided something.
 */
function toEvents(t: Transcript): ConnectorEvent[] {
  const header: ConnectorEvent = {
    sourceType: "transcript.meeting",
    externalId: `${t.id}:meta`,
    title: t.title,
    body: `Meeting "${t.title}" on ${t.startedAt.slice(0, 10)} with ${t.attendees.join(", ")}.`,
    participants: t.attendees,
    occurredAt: t.startedAt,
    url: `https://transcripts.internal/${t.id}`,
    metadata: {
      meeting: t.title,
      durationMinutes: t.durationMinutes,
      attendees: t.attendees,
      kind: "meeting",
    },
  };

  const turns = t.turns.map((turn, i) => ({
    sourceType: "transcript.meeting" as const,
    externalId: `${t.id}:${i}`,
    title: `${t.title} — ${turn.speaker}`,
    body: turn.text,
    author: turn.speaker,
    participants: t.attendees,
    // Turns are spaced a minute apart so ordering within a meeting survives.
    occurredAt: new Date(Date.parse(t.startedAt) + (i + 1) * 60_000).toISOString(),
    url: `https://transcripts.internal/${t.id}#t${i}`,
    metadata: {
      meeting: t.title,
      speaker: turn.speaker,
      attendees: t.attendees,
      kind: "turn",
    },
  }));

  return [header, ...turns];
}

export const transcriptsConnector: Connector = {
  id: "transcripts",
  name: "Meeting transcripts",
  blurb: "Recorded calls, turn by turn, with attendees preserved.",
  category: "meetings",
  sourceTypes: ["transcript.meeting"],
  teaches: ["meeting", "decision", "person", "project", "procedure"],
  defaultConnected: true,
  async fetch({ since, limit } = {}) {
    const events = TRANSCRIPTS.flatMap(toEvents)
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
