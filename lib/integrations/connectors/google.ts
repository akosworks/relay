import type { Connector, ConnectorEvent } from "../types";

/**
 * Google Docs and Google Drive.
 *
 * Two connectors, one file: they share a vendor and a payload shape, and
 * splitting them would duplicate the mapper for no benefit. The registry still
 * treats them as independent connectors that connect and sync separately.
 */

type GoogleFile = {
  id: string;
  name: string;
  owner: string;
  modifiedAt: string;
  mimeType: string;
  text: string;
};

const DOCS: GoogleFile[] = [
  {
    id: "doc-beta-launch-plan",
    name: "Relay beta launch plan v3",
    owner: "Dana Okafor",
    modifiedAt: "2026-07-13T14:25:00Z",
    mimeType: "application/vnd.google-apps.document",
    text: "Relay public beta plan, version 3. Launch date: 13 August 2026, revised from 16 July after the launch review. Launch is gated on RELAY-214, persistent storage, owned by Ines Duarte. Northwind Labs onboards the week of 17 August.",
  },
];

const DRIVE: GoogleFile[] = [
  {
    id: "file-relay-arch",
    name: "Relay architecture.excalidraw",
    owner: "Priya Raman",
    modifiedAt: "2026-05-21T17:45:00Z",
    mimeType: "application/octet-stream",
    text: "Diagram of the Relay pipeline: connectors, raw event storage, extraction, the memory graph on PostgreSQL, retrieval, then the agent.",
  },
];

function toEvent(file: GoogleFile, sourceType: "gdocs.document" | "gdrive.file"): ConnectorEvent {
  return {
    sourceType,
    externalId: file.id,
    title: file.name,
    body: file.text,
    author: file.owner,
    occurredAt: file.modifiedAt,
    url: `https://drive.google.com/file/d/${file.id}`,
    metadata: { owner: file.owner, mimeType: file.mimeType },
  };
}

export const googleDocsConnector: Connector = {
  id: "gdocs",
  name: "Google Docs",
  blurb: "Plans, roadmaps and anything written in a doc.",
  category: "documents",
  sourceTypes: ["gdocs.document"],
  teaches: ["document", "project", "decision", "procedure"],
  async fetch({ since, limit } = {}) {
    const events = DOCS.map((d) => toEvent(d, "gdocs.document"))
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};

export const googleDriveConnector: Connector = {
  id: "gdrive",
  name: "Google Drive",
  blurb: "Contracts, diagrams and files that never get read twice.",
  category: "storage",
  sourceTypes: ["gdrive.file"],
  teaches: ["document", "customer", "project"],
  async fetch({ since, limit } = {}) {
    const events = DRIVE.map((f) => toEvent(f, "gdrive.file"))
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
