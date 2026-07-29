import { redirect } from "next/navigation";

/**
 * "Ask Relay" on the marketing page used to land in a dedicated conversation
 * screen. Asking is now an overlay over the workspace rather than a page of its
 * own, so this lands on the dashboard, which is where someone arriving at work
 * wants to start. Kept as a redirect so the old address — and the link on the
 * landing page, which is not ours to change — still work.
 */
export default function ChatPage() {
  redirect("/home");
}
