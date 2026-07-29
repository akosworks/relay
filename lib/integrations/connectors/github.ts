import type { Connector, ConnectorEvent } from "../types";

/** GitHub. Where intent turns into shipped change, with authorship attached. */

type PullRequest = {
  number: number;
  repo: string;
  title: string;
  author: string;
  state: "merged" | "open";
  mergedAt?: string;
  createdAt: string;
  body: string;
  reviewers: string[];
};

type Issue = {
  number: number;
  repo: string;
  title: string;
  author: string;
  state: "open" | "closed";
  createdAt: string;
  body: string;
  labels: string[];
};

const PULL_REQUESTS: PullRequest[] = [
  {
    number: 476,
    repo: "atlas",
    title: "Idempotent payment intents",
    author: "Ines Duarte",
    state: "merged",
    createdAt: "2026-06-11T10:00:00Z",
    mergedAt: "2026-06-15T12:41:00Z",
    body: "Makes payment intent creation idempotent on a client supplied key so retries in the ledger cannot double charge. Part of Project Atlas.",
    reviewers: ["Yuki Tanaka"],
  },
  {
    number: 482,
    repo: "atlas",
    title: "SAML assertion validation",
    author: "Priya Raman",
    state: "open",
    createdAt: "2026-07-02T09:15:00Z",
    body: "First half of ATLAS-214. Validates SAML assertions from Okta and Entra, including signature and audience checks. Still open: identity provider metadata refresh and signed logout, which is why authentication cannot ship yet. Blocks the Project Atlas launch.",
    reviewers: ["Dana Okafor", "Yuki Tanaka"],
  },
  {
    number: 491,
    repo: "atlas",
    title: "Session cookie rotation on privilege change",
    author: "Priya Raman",
    state: "merged",
    createdAt: "2026-07-12T14:00:00Z",
    mergedAt: "2026-07-15T12:50:00Z",
    body: "Rotates the session token whenever a user's privileges change. Closes the last item from the Vantage Health security review other than SSO. Authentication is owned by Priya Raman.",
    reviewers: ["Dana Okafor"],
  },
  {
    number: 118,
    repo: "meridian",
    title: "Fix cold start crash on Android 15",
    author: "Yuki Tanaka",
    state: "open",
    createdAt: "2026-07-22T08:30:00Z",
    body: "Attempted fix for MER-77. The crash happens when the cached session is restored before the main thread is ready. Blocks the Project Meridian public beta.",
    reviewers: ["Priya Raman"],
  },
];

const ISSUES: Issue[] = [
  {
    number: 505,
    repo: "atlas",
    title: "Webhook retries drop events after three failures",
    author: "Theo Novak",
    state: "open",
    createdAt: "2026-07-18T13:20:00Z",
    body: "Kestrel Logistics reported that webhook deliveries stop retrying after three failures and the event is lost. Affects Project Atlas. Assigned to Ines Duarte.",
    labels: ["bug", "customer"],
  },
];

export const githubConnector: Connector = {
  id: "github",
  name: "GitHub",
  blurb: "Pull requests and issues, with who wrote and who reviewed.",
  category: "code",
  sourceTypes: ["github.pull_request", "github.issue"],
  teaches: ["feature", "issue", "person", "project", "task"],
  defaultConnected: true,
  async fetch({ since, limit } = {}) {
    const prs: ConnectorEvent[] = PULL_REQUESTS.map((pr) => ({
      sourceType: "github.pull_request",
      externalId: `${pr.repo}#${pr.number}`,
      title: `${pr.repo}#${pr.number} ${pr.title}`,
      body: pr.body,
      author: pr.author,
      participants: [pr.author, ...pr.reviewers],
      occurredAt: pr.mergedAt ?? pr.createdAt,
      url: `https://github.com/acme/${pr.repo}/pull/${pr.number}`,
      metadata: {
        repo: pr.repo,
        state: pr.state,
        reviewers: pr.reviewers,
        number: pr.number,
      },
    }));

    const issues: ConnectorEvent[] = ISSUES.map((issue) => ({
      sourceType: "github.issue",
      externalId: `${issue.repo}!${issue.number}`,
      title: `${issue.repo}#${issue.number} ${issue.title}`,
      body: issue.body,
      author: issue.author,
      occurredAt: issue.createdAt,
      url: `https://github.com/acme/${issue.repo}/issues/${issue.number}`,
      metadata: { repo: issue.repo, state: issue.state, labels: issue.labels },
    }));

    const events = [...prs, ...issues]
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
