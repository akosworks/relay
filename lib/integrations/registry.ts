import { githubConnector } from "./connectors/github";
import { gmailConnector } from "./connectors/gmail";
import { googleDocsConnector, googleDriveConnector } from "./connectors/google";
import { jiraConnector } from "./connectors/jira";
import { linearConnector } from "./connectors/linear";
import { notionConnector } from "./connectors/notion";
import { slackConnector } from "./connectors/slack";
import { transcriptsConnector } from "./connectors/transcripts";
import type { Connector } from "./types";

/**
 * The registry is the only place that knows which connectors exist.
 *
 * Adding a source is: write `connectors/<vendor>.ts`, add it to this array.
 * No other module changes.
 */
const CONNECTORS: Connector[] = [
  slackConnector,
  transcriptsConnector,
  notionConnector,
  githubConnector,
  gmailConnector,
  jiraConnector,
  linearConnector,
  googleDocsConnector,
  googleDriveConnector,
];

const BY_ID = new Map(CONNECTORS.map((c) => [c.id, c]));

export function listConnectors(): Connector[] {
  return CONNECTORS;
}

export function getConnector(id: string): Connector | null {
  return BY_ID.get(id) ?? null;
}

export function defaultConnectedIds(): string[] {
  return CONNECTORS.filter((c) => c.defaultConnected).map((c) => c.id);
}
