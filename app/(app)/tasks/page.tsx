import type { Metadata } from "next";
import { Tasks } from "@/components/app/Tasks";

export const metadata: Metadata = {
  title: "Tasks",
  description:
    "Every piece of work still open across the tools Relay reads, with what is left, what is done and how much of the day remains.",
};

export default function TasksPage() {
  return <Tasks />;
}
