import { isMockEnabled } from "./mode";
import type { Connector, ConnectorEvent, FetchOptions } from "./types";

/**
 * The one place that decides whether a connector is allowed to produce events.
 *
 * Keeping the rule here rather than inside each `fetch` means a new connector
 * cannot forget it, and the policy stays readable as three lines instead of
 * being reconstructed from six files.
 */
export async function fetchFromSource(
  connector: Connector,
  options: FetchOptions = {},
): Promise<ConnectorEvent[]> {
  // A configured account is read regardless of the switch: the switch governs
  // fixtures, not the user's own data.
  if (connector.isLive?.()) return connector.fetch(options);
  if (!isMockEnabled()) return [];
  return connector.fetch(options);
}

/** Sources that would produce nothing right now, for the UI to explain itself with. */
export function isSourceSilent(connector: Connector): boolean {
  return !connector.isLive?.() && !isMockEnabled();
}
