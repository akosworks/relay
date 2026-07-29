import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Relay", template: "%s · Relay" },
  description:
    "Relay is an AI agent that becomes an organization's memory. It learns from meetings, emails, documents, code, conversations, and decisions so knowledge never disappears when people leave.",
  openGraph: {
    title: "Relay",
    description: "Built to remember. Built to act.",
    siteName: "Relay",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="antialiased">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
