"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WideAccess } from "@/lib/wide-os/types";

const ExecutiveAuthContext = createContext<WideAccess | null>(null);

/**
 * Wraps /admin/* routes. Signals shared module views to use executive data scope
 * (all tenants, read/write) while RLS still enforces DB boundaries per role.
 */
export function ExecutiveAuthProvider({
  access,
  children,
}: {
  access: WideAccess;
  children: ReactNode;
}) {
  if (!access.executive) {
    throw new Error("ExecutiveAuthProvider requires executive access");
  }
  return (
    <ExecutiveAuthContext.Provider value={access}>{children}</ExecutiveAuthContext.Provider>
  );
}

export function useExecutiveAuth(): WideAccess {
  const ctx = useContext(ExecutiveAuthContext);
  if (!ctx) {
    throw new Error("useExecutiveAuth must be used within ExecutiveAuthProvider");
  }
  return ctx;
}

export function useOptionalExecutiveAuth(): WideAccess | null {
  return useContext(ExecutiveAuthContext);
}
