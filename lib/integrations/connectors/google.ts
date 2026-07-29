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
    id: "doc-atlas-launch-plan",
    name: "Atlas launch plan v3",
    owner: "Marcus Webb",
    modifiedAt: "2026-07-13T14:25:00Z",
    mimeType: "application/vnd.google-apps.document",
    text: "Project Atlas launch plan, version 3. Launch date: 13 August 2026, revised from 16 July after the launch review. Launch is gated on ATLAS-214, SAML SSO, owned by Priya Raman. Go or no go call on 11 August. Vantage Health onboards the week of 17 August. Customer comms written by Theo Novak. Version 2 assumed a 16 July date and is superseded.",
  },
  {
    id: "doc-q3-roadmap",
    name: "Q3 2026 roadmap",
    owner: "Dana Okafor",
    modifiedAt: "2026-06-26T08:00:00Z",
    mimeType: "application/vnd.google-apps.document",
    text: "Q3 priorities. One: launch Project Atlas. Two: Project Beacon rebuilds customer onboarding, target under three days. Three: Project Meridian public beta. Vantage Health signs in August, Kestrel Logistics renews in September.",
  },
];

const DRIVE: GoogleFile[] = [
  {
    id: "file-vantage-msa",
    name: "Vantage Health MSA (signed).pdf",
    owner: "Theo Novak",
    modifiedAt: "2026-06-30T12:00:00Z",
    mimeType: "application/pdf",
    text: "Master services agreement with Vantage Health, signed 30 June 2026. Security schedule requires single sign on via SAML for all administrative access. Initial term twelve months.",
  },
  {
    id: "file-atlas-arch",
    name: "Atlas architecture.excalidraw",
    owner: "Yuki Tanaka",
    modifiedAt: "2026-05-21T17:45:00Z",
    mimeType: "application/octet-stream",
    text: "Diagram of Project Atlas services: gateway, identity, ledger on PostgreSQL, provisioning API used by Project Beacon.",
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
