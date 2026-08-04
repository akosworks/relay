import type { Connector, ConnectorEvent } from "../types";
import { fetchGmailImapEvents, getGmailImapConfig } from "./gmail-imap";

/**
 * Gmail. Where customer commitments are actually made.
 *
 * Set `GMAIL_IMAP_USER` and `GMAIL_IMAP_APP_PASSWORD` and this reads a real
 * inbox over IMAP, read-only; otherwise it falls back to the fixtures below.
 * Same precedence as GitHub: a configured account is read regardless of the
 * mock-data switch, because that switch governs fixtures, not your own data.
 */

type Thread = {
  id: string;
  subject: string;
  from: string;
  to: string[];
  sentAt: string;
  body: string;
};

const THREADS: Thread[] = [
  {
    id: "thr-northwind-pilot",
    subject: "Northwind Labs evaluation — persistence requirement",
    from: "Alice Nkemdirim <a.nkemdirim@northwindlabs.example>",
    to: ["Theo Novak"],
    sentAt: "2026-07-08T09:12:00Z",
    body: "Following our evaluation, Northwind Labs requires that Relay keep its memory across restarts before we can begin the pilot. An agent that re-reads everything on each deploy is not something we can put in front of our team.",
  },
  {
    id: "thr-northwind-date",
    subject: "Re: Revised Relay beta date",
    from: "Theo Novak",
    to: ["Alice Nkemdirim <a.nkemdirim@northwindlabs.example>"],
    sentAt: "2026-07-13T10:40:00Z",
    body: "Confirming that the Relay public beta has moved to 13 August so that persistent storage ships with it. Northwind Labs onboarding starts the week after.",
  },
];

export const gmailConnector: Connector = {
  id: "gmail",
  name: "Gmail",
  blurb: "Customer threads and external commitments.",
  category: "email",
  sourceTypes: ["gmail.thread"],
  teaches: ["customer", "issue", "decision", "person"],
  isLive: () => getGmailImapConfig() !== null,
  async fetch(options = {}) {
    const config = getGmailImapConfig();
    if (config) return fetchGmailImapEvents(config, options);

    const { since, limit } = options;
    const events: ConnectorEvent[] = THREADS.map((t): ConnectorEvent => ({
      sourceType: "gmail.thread",
      externalId: t.id,
      title: t.subject,
      body: t.body,
      author: t.from,
      participants: t.to,
      occurredAt: t.sentAt,
      url: `https://mail.google.com/mail/u/0/#inbox/${t.id}`,
      metadata: { from: t.from, to: t.to, subject: t.subject },
    }))
      .filter((e) => (since ? e.occurredAt > since : true))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return limit ? events.slice(0, limit) : events;
  },
};
