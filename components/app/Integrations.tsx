"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { fetchIntegrations, runIntegrationAction } from "@/lib/client/api";
import type { SyncReport } from "@/lib/ingestion/pipeline";
import type { IntegrationSummary, PlannedIntegration } from "@/lib/integrations/types";
import { EASE } from "@/lib/motion";
import { useWorkspace } from "./WorkspaceProvider";
import { Connection, Label, Panel, PageHead, relativeDate, TYPE_LABEL } from "./ui";

/**
 * Sources.
 *
 * Connecting is the only setup this product has, so a card shows the one thing
 * that matters about a source: how much of Relay's memory came from it. Connect
 * one and the counters move — that is the whole feedback loop, and it is why the
 * numbers sit under a rule at the bottom of the card rather than in a badge at
 * the top. A source that has taught Relay nothing yet says zero, honestly.
 */

const CATEGORY_LABEL: Record<string, string> = {
  communication: "Conversation",
  email: "Email",
  documents: "Documents",
  storage: "Files",
  code: "Code",
};

/** Conversation first, code last: the order a company's knowledge actually flows. */
const CATEGORY_ORDER = ["communication", "email", "documents", "storage", "code"];

function Shell({
  children,
  interactive,
  delay,
}: {
  children: React.ReactNode;
  interactive: boolean;
  delay: number;
}) {
  return (
    <Panel interactive={interactive} delay={delay} className="flex flex-col px-7 py-7">
      {children}
    </Panel>
  );
}

function Head({
  name,
  category,
  status,
}: {
  name: string;
  category: string;
  status: "connected" | "disconnected" | "syncing";
}) {
  return (
    <div className="flex items-center gap-3.5">
      <Connection status={status} />
      <h3 className="text-[16.5px] font-medium tracking-[-0.022em] text-ink">{name}</h3>
      <span className="ml-auto shrink-0 text-[11px] uppercase tracking-[0.09em] text-ink-25">
        {CATEGORY_LABEL[category] ?? category}
      </span>
    </div>
  );
}

function Teaches({ types }: { types: string[] }) {
  return (
    <div className="mt-5 flex flex-wrap gap-1.5">
      {types.slice(0, 5).map((type) => (
        <span
          key={type}
          className="rounded-full bg-ink/[0.038] px-2.5 py-1 text-[11.5px] tracking-[-0.005em] text-ink-45"
        >
          {TYPE_LABEL[type as keyof typeof TYPE_LABEL] ?? type}
        </span>
      ))}
    </div>
  );
}

function Card({
  integration,
  busy,
  report,
  delay,
  onAction,
}: {
  integration: IntegrationSummary;
  busy: boolean;
  report?: SyncReport | null;
  delay: number;
  onAction: (action: "connect" | "disconnect" | "sync") => void;
}) {
  const connected = integration.status === "connected";
  const status = busy ? "syncing" : integration.status;

  return (
    <Shell interactive delay={delay}>
      <Head name={integration.name} category={integration.category} status={status} />

      <p className="mt-4 text-[14.5px] leading-[1.58] tracking-[-0.012em] text-ink-70">
        {integration.blurb}
      </p>

      <Teaches types={integration.teaches} />

      <div className="mt-auto">
        <div className="mt-7 flex items-baseline gap-6 border-t border-rule pt-4 text-[13px]">
          <span className="text-ink-45">
            <span className="tabular-nums text-ink">{integration.events}</span> events
          </span>
          <span className="text-ink-45">
            <span className="tabular-nums text-ink">{integration.memories}</span> memories
          </span>
          {integration.lastSyncAt && (
            <span className="ml-auto shrink-0 text-ink-25">
              synced {relativeDate(integration.lastSyncAt)}
            </span>
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
              Read {report.eventsStored} events, learned {report.entitiesCreated} memories and{" "}
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
                {busy ? "Reading…" : "Sync"}
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
              {busy ? "Reading…" : "Connect"}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

/** The same card with the one thing it cannot do left visibly undone. */
function PlannedCard({
  integration,
  delay,
}: {
  integration: PlannedIntegration;
  delay: number;
}) {
  return (
    <Shell interactive={false} delay={delay}>
      <Head name={integration.name} category={integration.category} status="disconnected" />

      <p className="mt-4 text-[14.5px] leading-[1.58] tracking-[-0.012em] text-ink-45">
        {integration.blurb}
      </p>

      <Teaches types={integration.teaches} />

      <div className="mt-auto">
        <div className="mt-7 border-t border-rule pt-4 text-[13px] text-ink-25">
          Not reading anything yet
        </div>
        <div className="mt-5">
          <span className="inline-flex h-[42px] w-full items-center justify-center rounded-full border border-dashed border-rule text-[14px] tracking-[-0.012em] text-ink-45">
            Coming soon
          </span>
        </div>
      </div>
    </Shell>
  );
}

export function Integrations() {
  const { refreshMemory } = useWorkspace();
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [planned, setPlanned] = useState<PlannedIntegration[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, SyncReport | null>>({});

  useEffect(() => {
    fetchIntegrations()
      .then((result) => {
        setIntegrations(result.integrations);
        setPlanned(result.planned);
      })
      .catch(() => setIntegrations([]));
  }, []);

  const act = async (id: string, action: "connect" | "disconnect" | "sync") => {
    setBusy(id);
    try {
      const result = await runIntegrationAction(id, action);
      setIntegrations((prev) => prev.map((i) => (i.id === id ? result.integration : i)));
      setReports((prev) => ({ ...prev, [id]: result.report }));
      // Connecting a source changes what every other surface knows. Re-read
      // memory now so the dashboard and the calendar are already right by the
      // time the user gets back to them.
      refreshMemory();
    } finally {
      setBusy(null);
    }
  };

  const connected = integrations.filter((i) => i.status !== "disconnected");
  const ordered = [...integrations].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );

  return (
    <div className="pb-28">
      <PageHead eyebrow="Integrations" title="Where Relay learns from.">
        Each source is read once, kept in its original form, and turned into structured
        memory that every answer can be traced back to. Connect one and watch what Relay
        knows grow.
      </PageHead>

      <p className="-mt-6 mb-10 text-[13.5px] tabular-nums text-ink-45">
        {connected.length} of {integrations.length} connected ·{" "}
        {connected.reduce((sum, i) => sum + i.memories, 0)} memories contributed
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {ordered.map((integration, i) => (
          <li key={integration.id} className="contents">
            <Card
              integration={integration}
              busy={busy === integration.id}
              report={reports[integration.id]}
              delay={0.04 + i * 0.05}
              onAction={(action) => act(integration.id, action)}
            />
          </li>
        ))}
      </ul>

      {planned.length > 0 && (
        <section className="mt-16">
          <Label>On the way</Label>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {planned.map((integration, i) => (
              <li key={integration.id} className="contents">
                <PlannedCard integration={integration} delay={0.05 + i * 0.05} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-14 max-w-[64ch] text-[13.5px] leading-[1.6] text-ink-45">
        In this build each connector reads from a fixture rather than a live account. They
        are independent modules behind one interface, so a production OAuth flow replaces
        the fetch without touching ingestion, extraction or memory.
      </p>
    </div>
  );
}
