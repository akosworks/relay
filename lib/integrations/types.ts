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
  /**
   * Whether this connector is configured to read a real account right now.
   * Undefined means "fixtures only" — the mock switch decides whether it runs
   * at all. Checked rather than stored so adding credentials takes effect on
   * the next sync instead of the next restart.
   */
  isLive?(): boolean;
  fetch(options?: FetchOptions): Promise<ConnectorEvent[]>;
}

/**
 * A source that is on the roadmap. It has everything a connector has except
 * the one thing that matters — a way to fetch — so it is kept out of the
 * registry and can only ever be rendered, never synced.
 */
export interface PlannedIntegration {
  id: string;
  name: string;
  blurb: string;
  category: ConnectorCategory;
  teaches: EntityType[];
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
  /** Reading a real account. The card says so, because it changes what an answer means. */
  live: boolean;
}
