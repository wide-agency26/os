"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getWorkspaceClientId } from "@/lib/workspace";
import { clientPaths, adminPaths } from "@/lib/wide-os/paths";
import { logPortalActivity } from "@/app/actions/portal-activity";
import { isClientRequestService, SERVICE_FIELD_CONFIG } from "@/lib/client-requests/services";
import { isSuperadmin } from "@/lib/rbac";

export type ClientRequestState = { error?: string; success?: string };

export type ClientRequestRow = {
  id: string;
  client_id: string;
  subject: string;
  body: string;
  status: string;
  service: string | null;
  form_answers: Record<string, unknown>;
  preferred_response_date: string | null;
  response_note: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function submitClientRequest(
  clientId: string,
  _prev: ClientRequestState,
  formData: FormData
): Promise<ClientRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const workspaceId = await getWorkspaceClientId(supabase, user.id);
  if (workspaceId !== clientId) return { error: "Access denied." };

  const service = String(formData.get("service") ?? "").trim();
  const preferred_response_date = String(formData.get("preferred_response_date") ?? "").trim();
  const additional_notes = String(formData.get("additional_notes") ?? "").trim();

  if (!isClientRequestService(service)) {
    return { error: "Choose a service." };
  }
  if (!preferred_response_date) {
    return { error: "Please choose the best date we can get back to you." };
  }

  const fields = SERVICE_FIELD_CONFIG[service];
  const form_answers: Record<string, string> = {};
  for (const field of fields) {
    const val = String(formData.get(field.name) ?? "").trim();
    if (field.required && !val) {
      return { error: `${field.label} is required.` };
    }
    if (val) form_answers[field.name] = val;
  }
  if (additional_notes) form_answers.additional_notes = additional_notes;

  const bodyLines = [
    `Service: ${service}`,
    `Preferred response date: ${preferred_response_date}`,
    ...Object.entries(form_answers).map(([k, v]) => `${k}: ${v}`),
  ];
  const body = bodyLines.join("\n");

  const { error } = await supabase.from("client_requests").insert({
    client_id: clientId,
    subject: service,
    body,
    service,
    form_answers,
    preferred_response_date,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  await logPortalActivity(clientId, "client_request", "New client request submitted", {
    service,
  });

  revalidatePath(clientPaths.dashboard(clientId));
  return { success: "Request submitted — we'll follow up soon." };
}

export async function respondToClientRequest(
  clientId: string,
  requestId: string,
  _prev: ClientRequestState,
  formData: FormData
): Promise<ClientRequestState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isSuperadmin(profile?.role)) {
    return { error: "Executive access required." };
  }

  const status = String(formData.get("status") ?? "in_progress").trim();
  const response_note = String(formData.get("response_note") ?? "").trim();
  if (!response_note) return { error: "Add a note for the client." };
  if (!["open", "in_progress", "closed"].includes(status)) {
    return { error: "Invalid status." };
  }

  const { error } = await supabase
    .from("client_requests")
    .update({
      status,
      response_note,
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq("id", requestId)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath(clientPaths.dashboard(clientId));
  revalidatePath(adminPaths.dashboard());
  return { success: "Response saved — the client can see your update." };
}
