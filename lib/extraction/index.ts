import { heuristicExtractor } from "./heuristic";
import { llmExtractor } from "./llm";
import type { Extractor } from "./types";

export type { Extractor, ExtractionContext } from "./types";
export { MentionResolver } from "./resolver";

/**
 * Where the extraction provider is chosen.
 *
 * The MVP runs the rule-based extractor so the whole pipeline works offline and
 * deterministically. A model-backed extractor is registered here and selected
 * by configuration; because it returns the same `ExtractionResult`, no other
 * module is aware of the change.
 */
const EXTRACTORS: Record<string, Extractor> = {
  [heuristicExtractor.id]: heuristicExtractor,
  [llmExtractor.id]: llmExtractor,
};

function hasLlmConfig(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim());
}

export function getExtractor(id = process.env.RELAY_EXTRACTOR ?? heuristicExtractor.id): Extractor {
  if (id === llmExtractor.id && !hasLlmConfig()) {
    return heuristicExtractor;
  }
  return EXTRACTORS[id] ?? heuristicExtractor;
}

export function listExtractors(): Extractor[] {
  return Object.values(EXTRACTORS);
}
