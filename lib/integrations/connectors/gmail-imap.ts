import { ImapFlow, type FetchMessageObject, type MessageAddressObject } from "imapflow";
import { simpleParser } from "mailparser";
import type { ConnectorEvent, FetchOptions } from "../types";

/**
 * Gmail, for real — over IMAP, strictly read-only.
 *
 * Every mailbox is opened with `readOnly: true`, which is an IMAP-protocol
 * guarantee enforced by the server, not a promise this code keeps by
 * convention: a client holding a read-only lock cannot set flags, delete, or
 * move a message even if it tried. Nothing here ever calls the write half of
 * imapflow's API.
 *
 * Auth is a Gmail App Password, not OAuth — simplest thing that works for a
 * personal read-only integration, at the cost of requiring 2FA on the
 * account. Swapping to XOAUTH2 later is a change to `getGmailImapConfig` and
 * the `auth` block below, nothing downstream.
 */

export type GmailImapConfig = {
  host: string;
  port: number;
  user: string;
  appPassword: string;
  mailboxes: string[];
};

export function getGmailImapConfig(): GmailImapConfig | null {
  const user = process.env.GMAIL_IMAP_USER?.trim();
  const appPassword = process.env.GMAIL_IMAP_APP_PASSWORD?.trim();
  if (!user || !appPassword) return null;

  const host = process.env.GMAIL_IMAP_HOST?.trim() || "imap.gmail.com";
  const port = Number(process.env.GMAIL_IMAP_PORT) || 993;
  const mailboxes = (process.env.GMAIL_IMAP_MAILBOXES ?? "INBOX")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return { host, port, user, appPassword, mailboxes: mailboxes.length ? mailboxes : ["INBOX"] };
}

/** How many messages one sync will read per mailbox. Recent history, not the whole account. */
const MESSAGES_PER_MAILBOX = 200;

/** How much of a message body extraction sees. Past this it's usually quoted history. */
const BODY_CHARS = 4_000;

function formatAddress(entry: MessageAddressObject): string {
  if (entry.name && entry.address) return `${entry.name} <${entry.address}>`;
  return entry.address ?? entry.name ?? "unknown";
}

function formatAddressList(entries?: MessageAddressObject[]): string[] {
  return (entries ?? []).map(formatAddress);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Cut a reply off where it starts quoting the message above it.
 *
 * Without this, message N in a thread carries messages 1..N-1 along with it
 * as quoted text, and the same paragraph gets extracted once per reply that
 * quotes it — a false corroboration of something only one person ever said.
 */
const QUOTE_START = [
  /^on .{0,120}wrote:\s*$/i,
  /^-{2,}\s*original message\s*-{2,}$/i,
  /^from:\s.+$/i,
];

function stripQuoted(body: string): string {
  const lines = body.split(/\r?\n/);
  const cut = lines.findIndex((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith(">")) return true;
    return QUOTE_START.some((re) => re.test(trimmed));
  });
  return (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
}

async function toConnectorEvent(
  msg: FetchMessageObject,
  mailbox: string,
): Promise<ConnectorEvent | null> {
  if (!msg.source) return null;

  const envelope = msg.envelope;
  const subject = envelope?.subject?.trim() || "(no subject)";
  const from = formatAddressList(envelope?.from)[0] ?? "unknown";
  const to = [...formatAddressList(envelope?.to), ...formatAddressList(envelope?.cc)];
  const occurredAt = new Date(envelope?.date ?? msg.internalDate ?? new Date()).toISOString();
  // externalId must survive a re-sync unchanged; Message-ID does, a UID does not
  // (UIDs are only stable within one UIDVALIDITY epoch for a mailbox).
  const externalId = envelope?.messageId?.trim() || `${mailbox}:${msg.uid}`;

  let text = "";
  try {
    const parsed = await simpleParser(msg.source);
    text = parsed.text?.trim() || (typeof parsed.html === "string" ? stripHtml(parsed.html) : "");
  } catch {
    // An unparseable message costs itself, not the sync.
    return null;
  }

  const body = stripQuoted(text).slice(0, BODY_CHARS) || subject;

  return {
    sourceType: "gmail.thread",
    externalId,
    title: subject,
    body,
    author: from,
    participants: to,
    occurredAt,
    metadata: {
      from,
      to,
      subject,
      mailbox,
      threadId: msg.threadId ?? null,
    },
  };
}

export async function fetchGmailImapEvents(
  config: GmailImapConfig,
  { since, limit }: FetchOptions = {},
): Promise<ConnectorEvent[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.appPassword },
    logger: false,
  });

  try {
    await client.connect();
  } catch {
    const error = new Error(
      `Gmail IMAP login failed for ${config.user}. Check GMAIL_IMAP_USER and GMAIL_IMAP_APP_PASSWORD ` +
        `(this must be an App Password, not the account password).`,
    );
    error.name = "GmailAuthError";
    throw error;
  }

  const events: ConnectorEvent[] = [];

  try {
    for (const mailbox of config.mailboxes) {
      let lock;
      try {
        lock = await client.getMailboxLock(mailbox, { readOnly: true });
      } catch {
        // A mailbox that doesn't exist or isn't selectable costs itself, not the sync.
        continue;
      }

      try {
        // `{ uid: true }` here (the options arg) means the search results below
        // are UIDs; it is unrelated to the `uid: true` inside the fetch query,
        // which asks imapflow to include the UID field on each result object.
        const query = since ? { since: new Date(since) } : { all: true };
        const uids = await client.search(query, { uid: true });
        if (!uids || uids.length === 0) continue;

        const recent = uids.slice(-MESSAGES_PER_MAILBOX);

        for await (const msg of client.fetch(
          recent,
          { uid: true, envelope: true, internalDate: true, threadId: true, source: true },
          { uid: true },
        )) {
          const event = await toConnectorEvent(msg, mailbox);
          if (event) events.push(event);
        }
      } finally {
        lock.release();
      }
    }
  } finally {
    await client.logout().catch(() => client.close());
  }

  const filtered = events
    .filter((e) => (since ? e.occurredAt > since : true))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return limit ? filtered.slice(0, limit) : filtered;
}
