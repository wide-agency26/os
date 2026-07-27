"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth-guards";
import { isUuid } from "@/lib/routing";
import {
  PREVIEW_COOKIE_CLIENT,
  PREVIEW_COOKIE_PROSPECT,
  PREVIEW_COOKIE_ROLE,
  isPreviewableRole,
  previewHomePath,
  previewRequiresClient,
  previewRequiresProspect,
  type PreviewContext,
} from "@/lib/preview-mode";

export type PreviewModeState = { error?: string };

function cookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function clearPreviewMode(): Promise<void> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return;

  const jar = await cookies();
  jar.delete(PREVIEW_COOKIE_ROLE);
  jar.delete(PREVIEW_COOKIE_CLIENT);
  jar.delete(PREVIEW_COOKIE_PROSPECT);
  redirect("/admin/dashboard");
}

export async function setPreviewMode(
  _prev: PreviewModeState,
  formData: FormData
): Promise<PreviewModeState> {
  const gate = await requireSuperadmin();
  if (!gate.ok) return { error: "Superadmin access required." };

  const roleRaw = String(formData.get("role") ?? "").trim();
  if (!isPreviewableRole(roleRaw)) {
    return { error: "Choose a role to preview." };
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const prospectId = String(formData.get("prospect_id") ?? "").trim();

  if (previewRequiresClient(roleRaw) && (!clientId || !isUuid(clientId))) {
    return { error: "Select a client workspace for client preview." };
  }
  if (previewRequiresProspect(roleRaw) && (!prospectId || !isUuid(prospectId))) {
    return { error: "Select a prospect for prospect preview." };
  }
  if (clientId && !isUuid(clientId)) return { error: "Invalid client id." };
  if (prospectId && !isUuid(prospectId)) return { error: "Invalid prospect id." };

  const preview: PreviewContext = {
    role: roleRaw,
    clientId: clientId || undefined,
    prospectId: prospectId || undefined,
  };

  const jar = await cookies();
  jar.set(PREVIEW_COOKIE_ROLE, roleRaw, cookieOptions());
  if (preview.clientId) jar.set(PREVIEW_COOKIE_CLIENT, preview.clientId, cookieOptions());
  else jar.delete(PREVIEW_COOKIE_CLIENT);
  if (preview.prospectId) jar.set(PREVIEW_COOKIE_PROSPECT, preview.prospectId, cookieOptions());
  else jar.delete(PREVIEW_COOKIE_PROSPECT);

  redirect(previewHomePath(preview));
}
