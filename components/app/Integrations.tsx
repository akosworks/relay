"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { fetchIntegrations, runIntegrationAction } from "@/lib/client/api";
import type { SyncReport } from "@/lib/ingestion/pipeline";
import type { IntegrationSummary } from "@/lib/integrations/types";
import { EASE } from "@/lib/motion";
import { AppShell } from "./AppShell";
import { relativeDate, StatusDot, TYPE_LABEL } from "./ui";

/**
 * Sources.
 *
 * Connecting is the only setup this product has, so the page shows the one
 * thing that matters about a source: how much memory it has contributed.
 * Connect and the counters move — that is the whole feedback loop.
 */

const CATEGORY_ORDER = [
  "communication",
  "meetings",
  "documents",
  "code",
  "tickets",
  "email",
  "storage",
] as const;

const CATEGORY_LABEL: Record<string, string> = {
  communication: "Conversation",
  meetings: "Meetings",
  documents: "Documents",
  code: "Code",
  tickets: "Tracked work",
  email: "Email",
  storage: "Files",
};

function Card({
  integration,
  busy,
  report,
  onAction,
}: {
  integration: IntegrationSummary;
  busy: boolean;
  report?: SyncReport | null;
  onAction: (action: "connect" | "disconnect" | "sync") => void;
}) {
  const connected = integration.status === "connected";

  return (
    <motion.li
      layout
      className={`flex flex-col rounded-3xl border px-6 py-6 transition-colors duration-500 ${
        connected ? "border-rule" : "border-rule/60"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <StatusDot status={busy ? "syncing" : integration.status} />
        <h3 className="text-[16.5px] font-medium tracking-[-0.022em] text-ink">
          {integration.name}
        </h3>
        <span className="ml-auto text-[11px] uppercase tracking-[0.09em] text-ink-25">
          {CATEGORY_LABEL[integration.category] ?? integration.category}
        </span>
      </div>

      <p className="mt-2.5 text-[14.5px] leading-[1.55] tracking-[-0.012em] text-ink-70">
        {integration.blurb}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {integration.teaches.slice(0, 5).map((type) => (
          <span
            key={type}
            className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11.5px] tracking-[-0.005em] text-ink-45"
          >
            {TYPE_LABEL[type]}
          </span>
        ))}
      </div>

      <div className="mt-6 flex items-baseline gap-6 border-t border-rule pt-4 text-[13px]">
        <span className="text-ink-45">
          <span className="tabular-nums text-ink">{integration.events}</span> events
        </span>
        <span className="text-ink-45">
          <span className="tabular-nums text-ink">{integration.memories}</span> memories
        </span>
        {integration.lastSyncAt && (
          <span className="ml-auto text-ink-25">synced {relativeDate(integration.lastSyncAt)}</span>
        )}
      </div>

      <AnimatePresence>
        {report && report.eventsStored > 0 && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: EASE.out }}
            className="overflow-hidden pt-3 text-[13px] tracking-[-0.01em] text-blue"
          >
            Read {report.eventsStored} events, learned {report.entitiesCreated} new memories and{" "}
            {report.relationships} links.
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5 flex gap-2">
        {connected ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction("sync")}
              className="h-[42px] flex-1 rounded-full border border-rule text-[14px] font-medium tracking-[-0.012em] text-ink transition-colors duration-500 hover:border-ink disabled:opacity-40"
            >
              {busy ? "Learning…" : "Sync"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction("disconnect")}
              className="h-[42px] rounded-full px-5 text-[14px] tracking-[-0.012em] text-ink-45 transition-colors duration-500 hover:text-ink disabled:opacity-40"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("connect")}
            className="h-[42px] flex-1 rounded-full bg-ink text-[14px] font-medium tracking-[-0.012em] text-paper transition-colors duration-500 hover:bg-blue disabled:opacity-40"
          >
            {busy ? "Learning…" : "Connect"}
          </button>
        )}
      </div>
    </motion.li>
  );
}

export function Integrations() {
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, SyncReport | null>>({});

  useEffect(() => {
    fetchIntegrations()
      .then((r) => setIntegrations(r.integrations))
      .catch(() => setIntegrations([]));
  }, []);

  const act = async (id: string, action: "connect" | "disconnect" | "sync") => {
    setBusy(id);
    try {
      const result = await runIntegrationAction(id, action);
      setIntegrations((prev) => prev.map((i) => (i.id === id ? result.integration : i)));
      setReports((prev) => ({ ...prev, [id]: result.report }));
    } finally {
      setBusy(null);
    }
  };

  const connected = integrations.filter((i) => i.status !== "disconnected");
  const ordered = [...integrations].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]) -
      CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]),
  );

  return (
    <AppShell>
      <div className="py-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE.out }}
        >
          <h1 className="display text-[clamp(2rem,4vw,2.75rem)]">Sources</h1>
          <p className="mt-4 max-w-[56ch] text-[16.5px] leading-[1.6] tracking-[-0.014em] text-ink-70">
            Every source Relay connects to is read once, stored in its original form, and
            turned into structured memory. Connect one and watch what it knows grow.
          </p>
          <p className="mt-5 text-[13.5px] text-ink-45">
            {connected.length} of {integrations.length} connected ·{" "}
            {connected.reduce((sum, i) => sum + i.memories, 0)} memories contributed
          </p>
        </motion.div>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2">
          {ordered.map((integration, i) => (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.05 + i * 0.04, ease: EASE.out }}
              className="contents"
            >
              <Card
                integration={integration}
                busy={busy === integration.id}
                report={reports[integration.id]}
                onAction={(action) => act(integration.id, action)}
              />
            </motion.div>
          ))}
        </ul>

        <p className="mt-10 max-w-[64ch] text-[13.5px] leading-[1.6] text-ink-45">
          Sample data stands in for real accounts in this build. Each source is an independent
          connector behind one interface, so a production OAuth flow replaces the mock fetch
          without touching ingestion, extraction or memory.
        </p>
      </div>
    </AppShell>
  );
}
