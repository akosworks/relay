/** Small text utilities shared by the extraction rules. Deliberately dumb. */

/** Split into sentences. Statements are the unit of extraction, not documents. */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const STOPWORDS = new Set([
  "the","a","an","of","to","in","on","for","and","or","but","is","are","was","were","be","been",
  "we","us","our","it","its","that","this","those","these","as","at","by","with","from","not",
  "will","would","can","cannot","could","should","have","has","had","do","does","did","so",
  "than","then","there","their","they","he","she","him","her","his","hers","them","because",
  "until","after","before","about","into","over","more","most","also","just","only","which",
  "what","when","who","whom","how","why","if","up","down","out","off","all","any","each","i",
]);

const MONTHS = new Set([
  "january","february","march","april","may","june","july","august","september","october",
  "november","december",
]);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

export function words(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z0-9'-]*|\d+/g) ?? [];
}

export function contentWords(text: string): string[] {
  return words(text)
    .map((w) => w.toLowerCase())
    .filter((w) => !isStopword(w) && !MONTHS.has(w) && !/^\d+$/.test(w) && w.length > 1);
}

/**
 * A stable identity for a free-text statement.
 *
 * "we decided to delay the Project Atlas launch from 16 July to 13 August" and
 * "we decided to delay the Project Atlas launch to 13 August" are the same
 * decision reported twice. Dropping dates and stopwords, then keeping a small
 * sorted set of the most significant words, makes both land on one key.
 */
export function signature(text: string, size = 4): string {
  const raw = words(text);
  const scored = new Map<string, number>();

  raw.forEach((word, i) => {
    const lower = word.toLowerCase();
    if (isStopword(lower) || MONTHS.has(lower) || /^\d+$/.test(lower) || lower.length < 3) return;
    // Proper nouns away from the sentence start carry the most identity.
    const proper = i > 0 && /^[A-Z]/.test(word);
    const score = (proper ? 3 : 1) + Math.max(0, 1 - i / 40);
    scored.set(lower, Math.max(scored.get(lower) ?? 0, score));
  });

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, size)
    .map(([w]) => w)
    .sort()
    .join("-");
}

/** Trim a clause to something that reads as a title. */
export function toTitle(clause: string, max = 110): string {
  let t = clause
    .replace(/\s+/g, " ")
    .replace(/^[,:;\-\s]+/, "")
    .replace(/[.,:;\s]+$/, "")
    .trim();
  // Cut trailing subordinate clauses: the reason belongs in `rationale`.
  t = t.split(/,?\s+(?:because|since|due to|so that|as we|given that)\b/i)[0].trim();
  if (t.length > max) t = `${t.slice(0, max - 1).replace(/\s\S*$/, "")}…`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** The reason clause, if the sentence gives one. */
export function rationale(sentence: string): string | null {
  const m = sentence.match(/\b(?:because|since|due to|so that|as a result of)\s+(.+)$/i);
  if (!m) return null;
  return m[1].replace(/[.\s]+$/, "").trim() || null;
}

/** A short quotable span around the match, for citation display. */
export function excerptOf(text: string, focus: string, max = 240): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const at = clean.toLowerCase().indexOf(focus.toLowerCase().slice(0, 40));
  if (at < 0) return `${clean.slice(0, max - 1)}…`;
  const start = Math.max(0, at - 60);
  const end = Math.min(clean.length, start + max);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`;
}

/** Dates written the way people write them in chat: "13 August", "16 July 2026". */
export function findDates(text: string): string[] {
  const re =
    /\b(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})\b/g;
  return [...text.matchAll(re)].map((m) => m[1]);
}
