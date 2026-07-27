"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WideAccess } from "@/lib/wide-os/types";

const WorkspaceAccessContext = createContext<WideAccess | null>(null);

/**
 * CM write routes and client read routes share components through this provider.
 * `privilege: write` → CM AI parser zones; `privilege: read` → client presentation.
 */
export function WorkspaceAccessProvider({
  access,
  children,
}: {
  access: WideAccess;
  children: ReactNode;
}) {
  return (
    <WorkspaceAccessContext.Provider value={access}>
      {children}
    </WorkspaceAccessContext.Provider>
  );
}

export function useWorkspaceAccess(): WideAccess {
  const ctx = useContext(WorkspaceAccessContext);
  if (!ctx) {
    throw new Error("useWorkspaceAccess must be used within WorkspaceAccessProvider");
  }
  return ctx;
}

export function useWorkspacePrivilege(): "read" | "write" {
  return useWorkspaceAccess().privilege;
}
