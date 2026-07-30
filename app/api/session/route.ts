import { clearedCookie, sessionCookie, verify } from "@/lib/auth";

/**
 * Signing in and out.
 *
 * The check runs on the server and the cookie is `HttpOnly`, so the browser
 * cannot talk itself into a session — which is the one thing worth getting
 * right even in a mock, because a door that any script can open is not a door.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = body?.email ?? "";
  const password = body?.password ?? "";

  if (!verify(email, password)) {
    // One message for both cases: which half was wrong is not the signer-in's
    // business, and saying so is how you enumerate accounts.
    return Response.json(
      { error: "That email and password do not match an account." },
      { status: 401 },
    );
  }

  const response = Response.json({ ok: true });
  response.headers.append("set-cookie", sessionCookie());
  return response;
}

export async function DELETE() {
  const response = Response.json({ ok: true });
  response.headers.append("set-cookie", clearedCookie());
  return response;
}
