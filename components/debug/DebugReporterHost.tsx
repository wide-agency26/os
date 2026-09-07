"use client";

import dynamic from "next/dynamic";

const DebugReporter = dynamic(
  () => import("./DebugReporter").then((m) => m.DebugReporter),
  { ssr: false }
);

export function DebugReporterHost({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return <DebugReporter enabled />;
}
