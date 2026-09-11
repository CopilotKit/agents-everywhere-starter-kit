import type { Metadata } from "next";
import { resolveModel } from "agent-core";
export const dynamic = "force-dynamic";
import { Providers } from "@/components/providers";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agents, Everywhere — web surface",
  description:
    "An incident workspace with shared context, native agent UI, and persistent Ambiguous follow-ups.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let modelAvailable = true;
  try {
    resolveModel();
  } catch {
    modelAvailable = false;
  } // The page displays setup instructions; no runtime request is attempted.
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers modelAvailable={modelAvailable}>{children}</Providers>
      </body>
    </html>
  );
}
