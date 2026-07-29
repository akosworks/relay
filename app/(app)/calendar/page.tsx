import type { Metadata } from "next";
import { Calendar } from "@/components/app/Calendar";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "A calendar view of your tasks and events, allowing you to visualize your schedule and plan ahead.",
};

export default function CalendarPage() {
  return <Calendar />;
}