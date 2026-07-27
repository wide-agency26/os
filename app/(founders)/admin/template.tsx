"use client";

import type { ReactNode } from "react";

/** Soft canvas swap — sidebar stays mounted in parent layout. */
export default function FounderAdminTemplate({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
