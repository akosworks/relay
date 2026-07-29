import type { Metadata } from "next";
import { Workspace } from "@/components/app/Workspace";

export const metadata: Metadata = {
  title: "Ask",
  description:
    "Ask Relay anything your company knows. Every answer is drawn from structured memory and shows the sources behind it.",
};

export default function ChatPage() {
  return <Workspace />;
}
