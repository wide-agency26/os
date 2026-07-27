import type { DepartmentId, KickoffPhaseId } from "@/lib/wide-os/types";

const uuid = (id: string) => id;

export type WorkMatrixTab = "all" | "actual" | "identified" | "unidentified";
export type WorkWorkspacePanel = "overview" | "delivery" | "knowledge" | "financial" | "settings";
export type InventoryTab = "people" | "expertise" | "tools" | "other";

export const adminPaths = {
  dashboard: () => "/admin/dashboard",
  clients: () => "/admin/clients",
  financials: () => "/admin/financials",
  services: () => "/admin/services",
  wideBook: () => "/admin/wide-book",
  resources: (tab: InventoryTab = "people") => `/admin/resources?tab=${tab}`,
  
  // Keep some nested utility paths if needed, mapped to new layout
  clientDetails: (clientId: string) => `/admin/clients/${uuid(clientId)}`,
  resourcePerson: (personId: string) => `/admin/resources/person/${uuid(personId)}`,
} as const;

export const clientPaths = {
  dashboard: (clientId: string) => `/client/${uuid(clientId)}/dashboard`,
  services: (clientId: string) => `/client/${uuid(clientId)}/services`,
  brandbook: (clientId: string) => `/client/${uuid(clientId)}/brandbook`,
  library: (clientId: string) => `/client/${uuid(clientId)}/library`,
  analytics: (clientId: string) => `/client/${uuid(clientId)}/analytics`,
  settings: (clientId: string) => `/client/${uuid(clientId)}/settings`,
} as const;

export function departmentPaths(dept: DepartmentId, executive: boolean) {
  // Legacy function can be simplified or return adminPaths for now
  return adminPaths;
}
