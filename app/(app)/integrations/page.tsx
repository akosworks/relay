import type { Metadata } from "next";
import { Integrations } from "@/components/app/Integrations";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect the tools your company already uses and Relay learns from them.",
};

export default function IntegrationsPage() {
  return <Integrations />;
}
