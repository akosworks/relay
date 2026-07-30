import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/auth";

/**
 * The lock on the workspace.
 *
 * Enforced here rather than in a layout so an unsigned request never reaches
 * the app at all — no flash of a dashboard before a redirect, and no route that
 * quietly stays open because someone added a page and forgot the check.
 *
 * In Next 16 this file is `proxy.ts`; the `middleware` convention it replaces
 * is deprecated.
 */

/** Everything past the front door, plus the old chat address that redirects in. */
const PROTECTED = ["/home", "/calendar", "/tasks", "/integrations", "/chat"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = isSignedIn(request.cookies.get(SESSION_COOKIE)?.value);

  const guarded = PROTECTED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (guarded && !signedIn) {
    const login = new URL("/login", request.url);
    // Remember where they were headed, so signing in finishes the journey
    // rather than dumping everyone on the dashboard.
    if (pathname !== "/home") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Already inside: the login page has nothing to offer.
  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/calendar/:path*", "/tasks/:path*", "/integrations/:path*", "/chat/:path*", "/login"],
};
