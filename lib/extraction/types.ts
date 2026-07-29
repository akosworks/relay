import type { ExtractionResult, RawEvent } from "@/lib/memory/types";
import type { MentionResolver } from "./resolver";

/**
 * The extraction boundary.
 *
 * An extractor turns one raw event into structured JSON — never into prose.
 * The MVP ships a deterministic rule-based extractor; a model-backed one
 * implements this same interface and returns the same shape, so swapping the
 * provider does not touch ingestion, storage, retrieval or chat.
 */
export interface ExtractionContext {
  /** Everything the memory already knows, for resolving mentions to entities. */
  resolver: MentionResolver;
  now: string;
}

export interface Extractor {
  id: string;
  label: string;
  /** Shown in the UI so a user can see which extractor produced a memory. */
  description: string;
  extract(event: RawEvent, ctx: ExtractionContext): Promise<ExtractionResult>;
}
