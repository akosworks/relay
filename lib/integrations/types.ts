import type { EntityType, RawEvent, SourceType } from "@/lib/memory/types";

/**
 * A connector is the only thing that knows about a vendor.
 *
 * It fetches records in whatever shape the vendor emits and hands back
 * `ConnectorEvent`s. Everything downstream — ingestion, extraction, memory,
 * retrieval, chat — is written against that one shape, so adding Salesforce or
 * Zoom later is a new file in `connectors/` and a line in the registry.
 */

export type ConnectorCategory =
  | "communication"
  | "code"
  | "documents"
  | "email"
  | "tickets"
  | "meetings"
  | "storage";

/** What a connector produces: a raw event minus the fields ingestion assigns. */
export type ConnectorEvent = Omit<RawEvent, "id" | "ingestedAt" | "integrationId">;

export interface FetchOptions {
  /** Incremental sync boundary. Mock connectors accept and honour it. */
  since?: string;
  limit?: number;
}

export interface Connector {
  id: string;
  name: string;
  /** One line for the integrations page. */
  blurb: string;
  category: ConnectorCategory;
  sourceTypes: SourceType[];
  /** The kinds of memory this source tends to produce. Shown to the user. */
  teaches: EntityType[];
  /** Connected out of the box, so a first-run visitor has something to ask about. */
  defaultConnected?: boolean;
  fetch(options?: FetchOptions): Promise<ConnectorEvent[]>;
}

export type IntegrationStatus = "connected" | "disconnected" | "syncing";

/** Per-connector runtime state, kept outside the connector so it stays pure. */
export interface IntegrationState {
  id: string;
  status: IntegrationStatus;
  connectedAt: string | null;
  lastSyncAt: string | null;
  events: number;
  memories: number;
}

export interface IntegrationSummary extends IntegrationState {
  name: string;
  blurb: string;
  category: ConnectorCategory;
  teaches: EntityType[];
}
