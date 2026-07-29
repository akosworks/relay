/**
 * People write dates the way they speak them.
 *
 * Memory stores what was written — "13 August", "on Friday" — because that is
 * what a source actually said and the agent quotes it back. Anything that has
 * to place a memory on a calendar needs a real day, so the conversion happens
 * here and once. Every function resolves against a reference date, usually the
 * moment the thing was said, because "Friday" only means something relative to
 * when it was written.
 */

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** `yyyy-mm-dd` in UTC. The only date format anything downstream compares. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * `yyyy-mm-dd` for the calendar day a moment falls on where the reader is.
 *
 * Anything the user sees or sets — a due date, an event, which square on the
 * grid is today — has to use this. `isoDay` would put someone in Auckland on
 * tomorrow's date for most of their afternoon, and someone in California on
 * yesterday's for most of their evening.
 */
export function localDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfDay(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const d = startOfDay(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

/**
 * "13 August", "August 13", "2026-08-13" → `yyyy-mm-dd`.
 *
 * A year is almost never written down in chat, so an omitted one is taken from
 * the reference date and rolled forward when that would put the date more than
 * half a year in the past — "13 August" written in December means next August.
 */
export function toISODate(written: string, reference: string): string | null {
  const text = written.trim().toLowerCase();

  const explicit = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (explicit) return `${explicit[1]}-${explicit[2]}-${explicit[3]}`;

  const dayFirst = text.match(/^(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/);
  const monthFirst = text.match(/^([a-z]+)\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  const parts = dayFirst
    ? { day: dayFirst[1], month: dayFirst[2], year: dayFirst[3] }
    : monthFirst
      ? { day: monthFirst[2], month: monthFirst[1], year: monthFirst[3] }
      : null;
  if (!parts) return null;

  const month = MONTHS.indexOf(parts.month);
  const day = Number(parts.day);
  if (month < 0 || day < 1 || day > 31) return null;

  const ref = startOfDay(reference);
  const year = parts.year ? Number(parts.year) : ref.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(candidate.getTime())) return null;

  if (!parts.year && candidate.getTime() < ref.getTime() - 183 * 86_400_000) {
    candidate.setUTCFullYear(year + 1);
  }
  return isoDay(candidate);
}

/**
 * "on Friday" → the first Friday on or after the reference day. Someone saying
 * it on a Friday means today; the alternative reading is a week out and is
 * almost never what was meant.
 */
function weekdayAfter(written: string, reference: string): string | null {
  const target = WEEKDAYS.indexOf(written.trim().toLowerCase());
  if (target < 0) return null;
  const ref = startOfDay(reference);
  const shift = (target - ref.getUTCDay() + 7) % 7;
  return addDays(isoDay(ref), shift);
}

const WRITTEN =
  /\d{1,2}\s+[A-Z][a-z]+(?:\s+\d{4})?|[A-Z][a-z]+\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2}/
    .source;
const WEEKDAY = /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/.source;

/**
 * The date a phrase is actually about.
 *
 * A sentence can hold a date that belongs to something else in it: "13 August,
 * revised from 16 July after the launch review" dates the launch, not the
 * review, and taking the nearest date would put the review on the wrong day and
 * then show it on a calendar as though someone had said so. So only a date the
 * phrase is grammatically joined to counts — the words immediately after it, led
 * by a preposition that binds a time to an event.
 */
export function dateBoundTo(tail: string, reference: string): string | null {
  const bound = tail.match(
    new RegExp(`^[\\s,]*(?:is\\s+|was\\s+|happens\\s+|scheduled\\s+|set\\s+)?(?:on|for|at)\\s+(${WRITTEN}|${WEEKDAY})\\b`, "i"),
  );
  if (!bound) return null;
  return toISODate(bound[1], reference) ?? weekdayAfter(bound[1], reference);
}
