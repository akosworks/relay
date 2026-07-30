/**
 * The front door.
 *
 * A mock, and honest about it: one account, checked against a constant. There
 * is no user table, no hashing and no session store, because there is no
 * multi-user product behind it yet — the door exists so the workspace has an
 * outside and an inside, not because anything here is secret.
 *
 * Everything a real implementation would replace lives in this file: swap
 * `verify` for a lookup and `SESSION_VALUE` for a signed token, and the proxy,
 * the route and the form all keep working unchanged.
 */

export const DEMO_EMAIL = "fun@relay.com";
export const DEMO_PASSWORD = "iloverelay";

export const SESSION_COOKIE = "relay_session";
const SESSION_VALUE = "signed-in";

/** A week. Long enough that a demo is never interrupted by signing in twice. */
const MAX_AGE = 60 * 60 * 24 * 7;

export function verify(email: string, password: string): boolean {
  return (
    email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD
  );
}

export function isSignedIn(value: string | undefined): boolean {
  return value === SESSION_VALUE;
}

export function sessionCookie(): string {
  return `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
