"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOverview } from "@/lib/client/api";
import type { MemoryOverview } from "@/lib/memory/overview";
import { AppShell } from "./AppShell";
import { Chat, type ChatHandle } from "./Chat";
import { EntityDrawer } from "./EntityDrawer";
import { MemoryPanel } from "./MemoryPanel";

/**
 * Holds the three things that need to know about each other: the conversation,
 * the context rail, and the memory being inspected. Keeping this state here is
 * what lets a memory opened from the rail be asked about in the chat.
 */
export function Workspace() {
  const [overview, setOverview] = useState<MemoryOverview | null>(null);
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const chat = useRef<ChatHandle>(null);

  const refresh = useCallback(() => {
    fetchOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <>
      <AppShell aside={<MemoryPanel overview={overview} onOpenEntity={setOpenEntity} />}>
        <Chat ref={chat} onLearned={refresh} onOpenEntity={setOpenEntity} />
      </AppShell>

      <EntityDrawer
        entityId={openEntity}
        onClose={() => setOpenEntity(null)}
        onOpenEntity={setOpenEntity}
        onAsk={(question) => {
          setOpenEntity(null);
          chat.current?.ask(question);
        }}
      />
    </>
  );
}
