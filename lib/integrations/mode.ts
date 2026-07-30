/**
 * Mock data: on or off. The switch is right here.
 *
 * Every connector in this build reads from a fixture. That is what makes the
 * product demonstrable with nothing connected — but the moment one source is
 * pulling real records, fixtures stop being a convenience and start being
 * fiction sitting next to fact in the same memory graph. So it is a switch.
 *
 * Live sources are unaffected either way: turning mock data off silences the
 * fixtures, never an account the user actually configured.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  ↓↓↓  THE SWITCH  ↓↓↓   true = fixtures fill memory. false = real sources only.
const MOCK_DATA = true;
// ─────────────────────────────────────────────────────────────────────────────

/** `RELAY_MOCK_DATA=off` (or `false`/`0`/`no`) overrides the constant above. */
export function isMockEnabled(): boolean {
  const raw = process.env.RELAY_MOCK_DATA?.trim().toLowerCase();
  if (!raw) return MOCK_DATA;
  return !["off", "false", "0", "no"].includes(raw);
}
