import type { ConnectorEvent, FetchOptions } from "../types";

/**
 * GitHub, for real.
 *
 * A personal access token and a list of repositories is the whole setup. The
 * REST API is called directly rather than through a client library: the two
 * endpoints this needs are stable, and a dependency that wraps them would hide
 * the one thing worth seeing here — that a live source and a fixture source
 * produce exactly the same `ConnectorEvent`, which is why nothing downstream
 * has to know which one it read.
 */

const API = "https://api.github.com";

export type GithubConfig = {
  token: string;
  /** Empty means every repository the token can see. */
  repos: string[];
};

/**
 * `GITHUB_TOKEN` is the whole setup.
 *
 * `GITHUB_REPOS=owner/repo,owner/other` narrows the sync to a named few; left
 * blank, Relay reads everything the token has access to. Reading everything is
 * the honest default for a memory product — a repository the user forgot to
 * list is exactly the one whose history they will later ask about.
 */
export function getGithubConfig(): GithubConfig | null {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_PAT?.trim();
  if (!token) return null;

  const repos = (process.env.GITHUB_REPOS ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => /^[\w.-]+\/[\w.-]+$/.test(r));

  return { token, repos };
}

type GithubUser = { login?: string } | null;

type GithubRepo = {
  full_name: string;
  archived?: boolean;
  /** Repos with issues disabled return 410 on the issues endpoint. */
  has_issues?: boolean;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  default_branch?: string;
  pushed_at?: string;
  created_at?: string;
  html_url?: string;
  private?: boolean;
};

type GithubCommit = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
  };
  author?: GithubUser;
};

type GithubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: GithubUser;
  labels: Array<{ name?: string } | string>;
  assignees?: GithubUser[];
  /** Present only on issues that are really pull requests. */
  pull_request?: { merged_at: string | null };
  draft?: boolean;
  merged_at?: string | null;
  requested_reviewers?: GithubUser[];
};

async function get<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "relay",
    },
    // Sync results are stored; letting the platform serve a cached body would
    // make a manual "Sync" click quietly do nothing.
    cache: "no-store",
  });

  if (!response.ok) {
    const rejected = response.status === 401 || response.status === 403;
    const error = new Error(
      rejected
        ? `GitHub rejected the token (${response.status}). Check GITHUB_TOKEN and its scopes.`
        : `GitHub request failed (${response.status}) for ${path}`,
    );
    // Named so a per-repository failure can be skipped while a bad token still
    // stops the whole sync.
    error.name = rejected ? "GithubAuthError" : "GithubRequestError";
    throw error;
  }

  return (await response.json().catch(() => null)) as T | null;
}

/** The README is markdown, not JSON, so it needs its own accept header. */
async function getRaw(path: string, token: string): Promise<string | null> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      accept: "application/vnd.github.raw",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "relay",
    },
    cache: "no-store",
  });

  // A repository with no README is the common case, not an error.
  if (response.status === 404) return null;
  if (!response.ok) return null;
  return response.text();
}

function login(user: GithubUser): string {
  return user?.login ?? "unknown";
}

function labelNames(labels: GithubIssue["labels"]): string[] {
  return labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean);
}

/**
 * A pull request body is often empty, and an empty body extracts to nothing.
 * The title carries the intent in that case, so it leads the text either way.
 */
function bodyText(issue: GithubIssue, repo: string): string {
  const body = (issue.body ?? "").trim();
  return body ? `${issue.title}. ${body}` : `${issue.title} in ${repo}.`;
}

function toPullRequest(issue: GithubIssue, repo: string): ConnectorEvent {
  const merged = issue.pull_request?.merged_at ?? issue.merged_at ?? null;
  const reviewers = (issue.requested_reviewers ?? []).map(login);

  return {
    sourceType: "github.pull_request",
    externalId: `${repo}#${issue.number}`,
    title: `${repo}#${issue.number} ${issue.title}`,
    body: bodyText(issue, repo),
    author: login(issue.user),
    participants: [login(issue.user), ...reviewers],
    occurredAt: merged ?? issue.created_at,
    url: issue.html_url,
    metadata: {
      repo,
      state: merged ? "merged" : issue.state,
      reviewers,
      number: issue.number,
      draft: issue.draft ?? false,
    },
  };
}

function toIssue(issue: GithubIssue, repo: string): ConnectorEvent {
  return {
    sourceType: "github.issue",
    externalId: `${repo}!${issue.number}`,
    title: `${repo}#${issue.number} ${issue.title}`,
    body: bodyText(issue, repo),
    author: login(issue.user),
    participants: [login(issue.user), ...(issue.assignees ?? []).map(login)],
    occurredAt: issue.created_at,
    url: issue.html_url,
    metadata: {
      repo,
      state: issue.state,
      labels: labelNames(issue.labels),
      assignees: (issue.assignees ?? []).map(login),
      number: issue.number,
    },
  };
}

/**
 * How much of a README to keep.
 *
 * The opening of a README is what the project says it is; the rest is usually
 * installation steps and badges. Extraction reads the whole body, so a 40kB
 * document would drown every other memory from the same repository in noise.
 */
const README_CHARS = 6_000;

/** Commits per repository per sync. Recent history, not the whole log. */
const COMMITS_PER_REPO = 30;

/**
 * The repository itself, as one event: what it is, plus its README.
 *
 * Without this a repository only exists in memory as a side effect of things
 * that happened *in* it. Asking "what is relay" would find issues that mention
 * it and nothing that says what it does — which is exactly the gap a README
 * fills for a human reading the repo for the first time.
 */
async function fetchRepositoryEvent(
  repo: string,
  token: string,
): Promise<ConnectorEvent | null> {
  let meta: GithubRepo | null = null;
  try {
    meta = await get<GithubRepo>(`/repos/${repo}`, token);
  } catch (error) {
    if (error instanceof Error && error.name === "GithubAuthError") throw error;
    return null;
  }
  if (!meta) return null;

  const readme = await getRaw(`/repos/${repo}/readme`, token);
  const name = repo.split("/")[1] ?? repo;

  const parts = [`${name} is a repository on GitHub.`];
  if (meta.description) parts.push(meta.description);
  if (meta.language) parts.push(`It is written mainly in ${meta.language}.`);
  if (meta.topics?.length) parts.push(`Topics: ${meta.topics.join(", ")}.`);
  if (readme?.trim()) {
    parts.push(`README:\n${readme.trim().slice(0, README_CHARS)}`);
  }

  return {
    sourceType: "github.repository",
    externalId: `${repo}@repo`,
    title: `${repo} repository`,
    body: parts.join("\n\n"),
    occurredAt: meta.pushed_at ?? meta.created_at ?? new Date().toISOString(),
    url: meta.html_url,
    metadata: {
      repo,
      language: meta.language ?? null,
      topics: meta.topics ?? [],
      private: meta.private ?? false,
      defaultBranch: meta.default_branch ?? null,
      hasReadme: Boolean(readme?.trim()),
    },
  };
}

/**
 * Recent commits.
 *
 * The subject line is the part a person wrote for other people; the trailing
 * body is usually generated trailers and co-author lines, so the subject leads
 * and the rest follows it rather than replacing it.
 */
async function fetchCommitEvents(
  repo: string,
  token: string,
  since?: string,
): Promise<ConnectorEvent[]> {
  const query = new URLSearchParams({ per_page: String(COMMITS_PER_REPO) });
  if (since) query.set("since", since);

  let commits: GithubCommit[] | null;
  try {
    commits = await get<GithubCommit[]>(`/repos/${repo}/commits?${query}`, token);
  } catch (error) {
    if (error instanceof Error && error.name === "GithubAuthError") throw error;
    // An empty repository has no commits and answers 409. Nothing to read.
    return [];
  }
  if (!Array.isArray(commits)) return [];

  return commits.map((commit) => {
    const [subject, ...rest] = commit.commit.message.split("\n");
    const body = rest.join("\n").trim();
    const author = commit.author?.login ?? commit.commit.author?.name ?? "unknown";
    const at = commit.commit.author?.date ?? new Date().toISOString();

    return {
      sourceType: "github.commit",
      externalId: `${repo}@${commit.sha}`,
      title: `${repo} ${commit.sha.slice(0, 7)} ${subject}`,
      body: body ? `${subject}\n\n${body}` : subject,
      author,
      occurredAt: at,
      url: commit.html_url,
      metadata: { repo, sha: commit.sha, subject },
    } satisfies ConnectorEvent;
  });
}

/** How many repositories one sync will walk when no list was configured. */
const REPO_PAGES = 3;
const REPO_PAGE_SIZE = 100;

/**
 * Every repository the token can reach, most recently pushed first.
 *
 * Ordering by `pushed` means the cap below, if it is ever reached, drops the
 * repositories nobody has touched in years rather than an arbitrary slice.
 * Archived repositories are skipped: they are history no one is adding to, and
 * they would crowd out live work in retrieval.
 */
async function listAccessibleRepos(token: string): Promise<string[]> {
  const names: string[] = [];

  for (let page = 1; page <= REPO_PAGES; page += 1) {
    const query = new URLSearchParams({
      affiliation: "owner,collaborator,organization_member",
      sort: "pushed",
      direction: "desc",
      per_page: String(REPO_PAGE_SIZE),
      page: String(page),
    });

    const repos = await get<GithubRepo[]>(`/user/repos?${query}`, token);
    if (!Array.isArray(repos) || repos.length === 0) break;

    for (const repo of repos) {
      if (repo.archived) continue;
      if (repo.full_name) names.push(repo.full_name);
    }

    if (repos.length < REPO_PAGE_SIZE) break;
  }

  return names;
}

/** The configured list if there is one, otherwise everything the token sees. */
export async function resolveRepos(config: GithubConfig): Promise<string[]> {
  return config.repos.length > 0 ? config.repos : listAccessibleRepos(config.token);
}

/**
 * One page of recent issues and pull requests per repository.
 *
 * `/issues` returns both — a pull request is an issue with a `pull_request`
 * field — so a single call per repo covers the two source types this connector
 * declares, and the split happens on that field.
 */
export async function fetchGithubEvents(
  config: GithubConfig,
  { since, limit }: FetchOptions = {},
): Promise<ConnectorEvent[]> {
  const repos = await resolveRepos(config);
  const perRepo = Math.min(limit ?? 50, 100);
  const events: ConnectorEvent[] = [];

  for (const repo of repos) {
    // What the repository is, then what has happened in it. The repository
    // event is refetched every sync but stored under a stable externalId, so
    // ingestion treats it as the same record rather than a new one each time.
    const repository = await fetchRepositoryEvent(repo, config.token);
    if (repository) events.push(repository);

    events.push(...(await fetchCommitEvents(repo, config.token, since)));

    const query = new URLSearchParams({
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: String(perRepo),
    });
    // GitHub filters on updated_at; the occurredAt filter below still applies,
    // so this is a bandwidth optimisation rather than the boundary itself.
    if (since) query.set("since", since);

    let issues: GithubIssue[] | null;
    try {
      issues = await get<GithubIssue[]>(`/repos/${repo}/issues?${query}`, config.token);
    } catch (error) {
      // A repository with issues disabled, or one the token lost access to,
      // should cost that repository and nothing else. A rejected token is not
      // survivable that way, so it still stops the sync.
      if (error instanceof Error && error.name === "GithubAuthError") throw error;
      continue;
    }

    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      events.push(
        issue.pull_request ? toPullRequest(issue, repo) : toIssue(issue, repo),
      );
    }
  }

  const filtered = events
    .filter((e) => (since ? e.occurredAt > since : true))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return limit ? filtered.slice(0, limit) : filtered;
}
