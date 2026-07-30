import type { Connector, ConnectorEvent } from "../types";
import { fetchGithubEvents, getGithubConfig } from "./github-api";

/**
 * GitHub. Where intent turns into shipped change, with authorship attached.
 *
 * The only connector here that can read a real account: set `GITHUB_TOKEN` and
 * `GITHUB_REPOS` and it pulls from the API, otherwise it falls back to the
 * fixtures below. The token takes precedence over the mock switch — once a real
 * repository is being read, fixtures would only pollute it.
 */

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
    number: 482,
    repo: "relay",
    title: "Postgres-backed MemoryStore",
    author: "Ines Duarte",
    state: "open",
    createdAt: "2026-07-02T09:15:00Z",
    body: "First half of RELAY-214. Entities and relationships in Postgres behind the existing store interface. Still open: raw event storage and the bootstrap path, which is why persistence cannot ship yet. Blocks the Relay public beta.",
    reviewers: ["Dana Okafor"],
  },
  {
    number: 491,
    repo: "relay",
    title: "Refuse to answer from unretrieved memory",
    author: "Priya Raman",
    state: "merged",
    createdAt: "2026-07-12T14:00:00Z",
    mergedAt: "2026-07-15T12:50:00Z",
    body: "The agent now answers only from memories retrieval actually reached. Closes the last item from the Northwind Labs evaluation other than persistence. Retrieval is owned by Priya Raman.",
    reviewers: ["Dana Okafor"],
  },
];

const ISSUES: Issue[] = [
  {
    number: 505,
    repo: "relay",
    title: "Memory does not survive a serverless deploy",
    author: "Theo Novak",
    state: "open",
    createdAt: "2026-07-18T13:20:00Z",
    body: "Northwind Labs reported that Relay forgets everything between requests on a hosted deploy. The memory graph lives in process. Assigned to Ines Duarte.",
    labels: ["bug", "customer"],
  },
];

export const githubConnector: Connector = {
  id: "github",
  name: "GitHub",
  blurb: "Repositories, commits, pull requests and issues, with who wrote and who reviewed.",
  category: "code",
  sourceTypes: [
    "github.repository",
    "github.commit",
    "github.pull_request",
    "github.issue",
  ],
  teaches: ["project", "feature", "issue", "person", "task", "document"],
  isLive: () => getGithubConfig() !== null,
  async fetch(options = {}) {
    const config = getGithubConfig();
    if (config) return fetchGithubEvents(config, options);

    const { since, limit } = options;
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
