/**
 * There is no auth in the app yet, so every row is scoped to one hardcoded
 * user. Swapping this for a real session lookup later is a one-line change:
 * every table already has `user_id` as part of its primary key.
 */
export const DEFAULT_USER_ID = "relayuser";

export function getUserId(): string {
  return DEFAULT_USER_ID;
}
