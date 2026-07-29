import type { EntityType } from "@/lib/memory/types";

/**
 * What is the question actually asking for?
 *
 * Not classification for its own sake: the intent decides which memory types
 * are worth ranking highly, which graph edges matter, and how the answer is
 * shaped. "Who owns authentication" wants a person reached through an `owns`
 * edge; "why was the launch delayed" wants a decision and its rationale.
 */
export type IntentKind =
  | "why"
  | "who_owns"
  | "who"
  | "how"
  | "summarize"
  | "changed"
  | "when"
  | "general";

export interface Intent {
  kind: IntentKind;
  /** Entity types to prefer when ranking. */
  bias: EntityType[];
  /** Restrict to memory learned or dated after this, when the question is temporal. */
  since?: string;
  /** Phrase the question is centred on, if it names one. */
  subject?: string;
}

const RULES: { re: RegExp; kind: IntentKind; bias: EntityType[] }[] = [
  { re: /\bwho\s+(?:owns|is responsible for|leads|runs)\b|\bowner of\b/i, kind: "who_owns", bias: ["person", "feature", "project", "procedure"] },
  { re: /^why\b|\bwhy\s+(?:was|were|did|is|are|do)\b|\breason(?:ing)? (?:for|behind)\b/i, kind: "why", bias: ["decision", "issue", "task"] },
  { re: /\bwhat (?:has )?changed\b|\bwhat'?s new\b|\bupdates? (?:since|on)\b|\bsince\b/i, kind: "changed", bias: ["decision", "task", "issue", "meeting"] },
  { re: /\b(?:explain|walk me through|how do we|how does the|what is our|describe)\b.*\b(?:process|onboarding|procedure|runbook|workflow|works?)\b/i, kind: "how", bias: ["procedure", "document", "project"] },
  { re: /\b(?:summari[sz]e|tell me (?:about|everything)|everything about|overview of|status of|catch me up)\b/i, kind: "summarize", bias: ["project", "decision", "task", "person"] },
  { re: /\bwhen (?:is|was|will|did|does)\b|\bwhat date\b|\btimeline\b/i, kind: "when", bias: ["decision", "meeting", "task", "project"] },
  { re: /\bwho\b/i, kind: "who", bias: ["person", "meeting"] },
  { re: /\b(?:explain|how do we|how does)\b/i, kind: "how", bias: ["procedure", "document"] },
];

const SUBJECT_RE =
  /\b(?:about|of|on|for|regarding|with)\s+([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)*)|^([A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*)+)/;

/** "last month", "this quarter" — coarse, but people ask coarse questions. */
function relativeSince(question: string, now: Date): string | undefined {
  const q = question.toLowerCase();
  const shift = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  if (/\blast week\b|\bpast week\b/.test(q)) return shift(7);
  if (/\blast month\b|\bpast month\b|\bfour weeks\b/.test(q)) return shift(35);
  if (/\blast quarter\b|\bthis quarter\b|\bpast (?:three|3) months\b/.test(q)) return shift(95);
  if (/\bthis year\b|\bpast year\b/.test(q)) return shift(365);
  return undefined;
}

export function analyzeIntent(question: string, now = new Date()): Intent {
  const matched = RULES.find((r) => r.re.test(question));
  const subject = question.match(SUBJECT_RE);

  return {
    kind: matched?.kind ?? "general",
    bias: matched?.bias ?? [],
    since: relativeSince(question, now),
    subject: (subject?.[1] ?? subject?.[2])?.trim(),
  };
}
