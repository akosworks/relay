import { githubConnector } from "./connectors/github";
import { gmailConnector } from "./connectors/gmail";
import { googleDocsConnector, googleDriveConnector } from "./connectors/google";
import { notionConnector } from "./connectors/notion";
import { slackConnector } from "./connectors/slack";
import type { Connector, PlannedIntegration } from "./types";

/**
 * The registry is the only place that knows which connectors exist.
 *
 * Adding a source is: write `connectors/<vendor>.ts`, add it to this array.
 * No other module changes.
 */
const CONNECTORS: Connector[] = [
  slackConnector,
  gmailConnector,
  notionConnector,
  googleDocsConnector,
  googleDriveConnector,
  githubConnector,
];

/**
 * Sources that are built but not shipped. Listed separately from the registry
 * rather than as a connector with a disabled flag, so nothing downstream can
 * accidentally try to sync one: the routes resolve ids through `getConnector`,
 * which never returns these.
 */
const PLANNED: PlannedIntegration[] = [
  {
    id: "microsoft-teams",
    name: "Microsoft Teams",
    blurb: "Channels, chats and meeting recaps from across the tenant.",
    category: "communication",
    teaches: ["person", "meeting", "decision", "project"],
  },
];

const BY_ID = new Map(CONNECTORS.map((c) => [c.id, c]));

export function listConnectors(): Connector[] {
  return CONNECTORS;
}

export function listPlanned(): PlannedIntegration[] {
  return PLANNED;
}

export function getConnector(id: string): Connector | null {
  return BY_ID.get(id) ?? null;
}

export function connectorName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}
