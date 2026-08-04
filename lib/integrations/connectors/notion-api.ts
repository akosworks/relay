import type { ConnectorEvent, FetchOptions } from "../types";

/**
 * Notion, for real.
 *
 * Direct REST calls, same choice as the GitHub connector: the handful of
 * endpoints this needs are stable, and a full SDK would hide the one thing
 * worth seeing — that a live source and a fixture source produce exactly the
 * same `ConnectorEvent`.
 *
 * Notion has no account-wide token scope. An internal integration only sees
 * pages someone explicitly shared with it in the Notion UI, so a correctly
 * configured token can still legitimately return zero pages — that is not an
 * error, it is the honest empty state (see `isSourceSilent` upstream).
 */

const API = "https://api.notion.com/v1";

export type NotionConfig = { token: string; version: string };

export function getNotionConfig(): NotionConfig | null {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) return null;
  const version = process.env.NOTION_VERSION?.trim() || "2022-06-28";
  return { token, version };
}

type RichText = { plain_text: string };
type NotionPropertyValue = { type: string; title?: RichText[] };
type NotionParent =
  | { type: "database_id"; database_id: string }
  | { type: "page_id"; page_id: string }
  | { type: "workspace" }
  | { type: "block_id"; block_id: string };

type NotionPage = {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  archived?: boolean;
  in_trash?: boolean;
  parent: NotionParent;
  created_by: { id: string };
  properties: Record<string, NotionPropertyValue>;
};

type NotionSearchResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

type NotionBlockChildrenResponse = {
  results: NotionBlock[];
  has_more: boolean;
  next_cursor: string | null;
};

type NotionUser = { id: string; name?: string };
type NotionDatabase = { id: string; title: RichText[] };

async function call<T>(config: NotionConfig, path: string, init: RequestInit = {}): Promise<T | null> {
  const attempt = () =>
    fetch(`${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${config.token}`,
        "notion-version": config.version,
        "content-type": "application/json",
        ...init.headers,
      },
      // Sync results are stored; a cached body would make a manual "Sync" quietly do nothing.
      cache: "no-store",
    });

  let response = await attempt();

  // Notion enforces roughly 3 requests/second. This connector is inherently
  // N+1 (search, then a blocks call and a user lookup per page), so a burst
  // is likely enough during a real sync to be worth one retry rather than
  // failing the sync over it.
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after")) || 1;
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    response = await attempt();
  }

  if (!response.ok) {
    const rejected = response.status === 401 || response.status === 403;
    const error = new Error(
      rejected
        ? `Notion rejected the token (${response.status}). Check NOTION_TOKEN.`
        : `Notion request failed (${response.status}) for ${path}`,
    );
    // Named so a per-page failure can be skipped while a bad token still stops the whole sync.
    error.name = rejected ? "NotionAuthError" : "NotionRequestError";
    throw error;
  }

  return (await response.json().catch(() => null)) as T | null;
}

function richTextToPlain(items?: RichText[]): string {
  return (items ?? []).map((t) => t.plain_text).join("");
}

/**
 * A page's title isn't a flat field — it's whichever property in its
 * (database-defined, so variably named) property bag has `type: "title"`.
 */
function pageTitle(page: NotionPage): string {
  for (const value of Object.values(page.properties)) {
    if (value.type === "title") {
      const text = richTextToPlain(value.title).trim();
      if (text) return text;
    }
  }
  return "Untitled";
}

/** How many pages one sync will read. Bounded because each page costs its own request(s). */
const PAGES_PER_SYNC = 50;
const SEARCH_PAGE_SIZE = 25;

/**
 * Every page the integration can see, most recently edited first.
 *
 * Notion's search has no server-side date filter, only this sort order — so
 * `since` is applied by stopping pagination once results fall behind it
 * rather than by a query parameter, mirroring the intent (not the mechanism)
 * of GitHub's `?since=`.
 */
async function searchPages(config: NotionConfig, since?: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: SEARCH_PAGE_SIZE,
    };
    if (cursor) body.start_cursor = cursor;

    const response = await call<NotionSearchResponse>(config, "/search", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response) break;

    for (const page of response.results) {
      if (page.archived || page.in_trash) continue;
      if (since && page.last_edited_time <= since) return pages;
      pages.push(page);
      if (pages.length >= PAGES_PER_SYNC) return pages;
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

const TEXT_BLOCK_TYPES = new Set([
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "to_do",
  "quote",
  "callout",
  "toggle",
  "code",
]);

function blockText(block: NotionBlock): string {
  const data = block[block.type] as { rich_text?: RichText[] } | undefined;
  return richTextToPlain(data?.rich_text);
}

/** Nested toggles and columns go this deep and no further, to bound requests per page. */
const MAX_BLOCK_DEPTH = 2;
/** How much of a page extraction sees. Past this it's usually appendices and tables. */
const BODY_CHARS = 4_000;

async function fetchBlockChildren(
  config: NotionConfig,
  blockId: string,
  depth: number,
): Promise<string[]> {
  const lines: string[] = [];
  let cursor: string | undefined;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);

    const response = await call<NotionBlockChildrenResponse>(
      config,
      `/blocks/${blockId}/children?${query}`,
    );
    if (!response) break;

    for (const block of response.results) {
      if (TEXT_BLOCK_TYPES.has(block.type)) {
        const text = blockText(block);
        if (text) lines.push(text);
      }
      if (block.has_children && depth < MAX_BLOCK_DEPTH) {
        lines.push(...(await fetchBlockChildren(config, block.id, depth + 1)));
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return lines;
}

/** `created_by` on a page is only an id; the display name needs its own call. */
async function resolveUserName(
  config: NotionConfig,
  userId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(userId);
  if (cached) return cached;

  try {
    const user = await call<NotionUser>(config, `/users/${userId}`);
    const name = user?.name ?? "unknown";
    cache.set(userId, name);
    return name;
  } catch {
    return "unknown";
  }
}

/** The containing database's title, when there is one — a page's "space", same idea as a repo. */
async function resolveSpace(
  config: NotionConfig,
  page: NotionPage,
  cache: Map<string, string>,
): Promise<string> {
  if (page.parent.type !== "database_id") return "Notion";
  const databaseId = page.parent.database_id;

  const cached = cache.get(databaseId);
  if (cached) return cached;

  try {
    const database = await call<NotionDatabase>(config, `/databases/${databaseId}`);
    const name = richTextToPlain(database?.title).trim() || "Notion";
    cache.set(databaseId, name);
    return name;
  } catch {
    return "Notion";
  }
}

export async function fetchNotionEvents(
  config: NotionConfig,
  { since, limit }: FetchOptions = {},
): Promise<ConnectorEvent[]> {
  const pages = await searchPages(config, since);

  const userCache = new Map<string, string>();
  const spaceCache = new Map<string, string>();
  const events: ConnectorEvent[] = [];

  for (const page of pages) {
    let bodyLines: string[];
    try {
      bodyLines = await fetchBlockChildren(config, page.id, 0);
    } catch (error) {
      if (error instanceof Error && error.name === "NotionAuthError") throw error;
      // A single page that stopped being readable mid-sync costs itself, not the sync.
      continue;
    }

    const title = pageTitle(page);
    const [author, space] = await Promise.all([
      resolveUserName(config, page.created_by.id, userCache),
      resolveSpace(config, page, spaceCache),
    ]);

    events.push({
      sourceType: "notion.page",
      externalId: page.id,
      title,
      body: bodyLines.join("\n\n").slice(0, BODY_CHARS) || title,
      author,
      occurredAt: page.last_edited_time,
      url: page.url,
      metadata: { space, author },
    });
  }

  const filtered = events
    .filter((e) => (since ? e.occurredAt > since : true))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return limit ? filtered.slice(0, limit) : filtered;
}
