import type { Metadata } from "next";
import { Dashboard } from "@/components/app/Dashboard";

export const metadata: Metadata = {
  title: "Home",
  description:
    "What is on you today, what is coming, and what Relay has learned about your company since you were last here.",
};

export default function HomePage() {
  return <Dashboard />;
}
