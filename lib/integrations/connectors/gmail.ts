import type { Connector, ConnectorEvent } from "../types";

/** Gmail. Where customer commitments are actually made. */

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
    id: "thr-vantage-security",
    subject: "Vantage Health security review — SSO requirement",
    from: "Alice Nkemdirim <a.nkemdirim@vantagehealth.example>",
    to: ["Theo Novak", "Marcus Webb"],
    sentAt: "2026-07-08T09:12:00Z",
    body: "Following our security review, Vantage Health requires SAML single sign on before we can begin rollout. This is a hard requirement from our security team and it is written into the contract. We cannot put clinical staff on a shared password flow.",
  },
  {
    id: "thr-vantage-date",
    subject: "Re: Revised Atlas launch date",
    from: "Theo Novak",
    to: ["Alice Nkemdirim <a.nkemdirim@vantagehealth.example>"],
    sentAt: "2026-07-13T10:40:00Z",
    body: "Confirming that the Project Atlas launch has moved to 13 August so that SAML SSO ships with it. Vantage Health onboarding starts the week after, and nothing else in your rollout plan changes.",
  },
  {
    id: "thr-kestrel-webhooks",
    subject: "Kestrel Logistics — webhook deliveries being dropped",
    from: "Rui Alves <rui@kestrel-logistics.example>",
    to: ["Theo Novak"],
    sentAt: "2026-07-17T16:05:00Z",
    body: "We are losing shipment events. Webhook deliveries appear to stop retrying after three failures and the event is never redelivered. This affects Kestrel Logistics reconciliation daily and we would like it fixed before our September renewal.",
  },
];

export const gmailConnector: Connector = {
  id: "gmail",
  name: "Gmail",
  blurb: "Customer threads and external commitments.",
  category: "email",
  sourceTypes: ["gmail.thread"],
  teaches: ["customer", "issue", "decision", "person"],
  async fetch({ since, limit } = {}) {
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
