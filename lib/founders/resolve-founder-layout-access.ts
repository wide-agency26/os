import { resolveExecutiveAccess } from "@/lib/wide-os/resolve-access";
import type { WideAccess } from "@/lib/wide-os/types";

/** Persistent founder frame — superadmin only (matches WIDE OS 5-panel IA). */
export async function resolveFounderLayoutAccess(): Promise<WideAccess> {
  return resolveExecutiveAccess();
}
