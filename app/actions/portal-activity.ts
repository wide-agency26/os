"use server";

import { createClient } from "@/utils/supabase/server";
import { getWorkspaceClientId } from "@/lib/workspace";

export async function logPortalActivity(
  clientId: string,
  eventType: string,
  title: string,
  meta?: Record<string, unknown>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("portal_activity").insert({
    client_id: clientId,
    actor_id: user.id,
    event_type: eventType,
    title,
    meta: meta ?? {},
  });
}

export async function touchLastPortalVisit() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: row, error: readErr } = await supabase
    .from("profiles")
    .select("last_portal_visit")
    .eq("id", user.id)
    .maybeSingle();

  if (readErr) return;

  const last = row?.last_portal_visit ? new Date(row.last_portal_visit as string).getTime() : 0;
  if (Date.now() - last < 60 * 60 * 1000) return;

  await supabase
    .from("profiles")
    .update({ last_portal_visit: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", user.id);

  const workspaceId = await getWorkspaceClientId(supabase, user.id);
  await supabase.from("portal_activity").insert({
    client_id: workspaceId,
    actor_id: user.id,
    event_type: "portal_visit",
    title: "Opened the portal",
    meta: {},
  });
}

export async function recordVaultDownload(fileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: file } = await supabase
    .from("vault_files")
    .select("client_id, label, external_url")
    .eq("id", fileId)
    .maybeSingle();

  if (!file) return;

  await supabase.from("vault_downloads").insert({
    file_id: fileId,
    user_id: user.id,
  });

  const openedExternal = Boolean(file.external_url);

  await supabase.from("portal_activity").insert({
    client_id: file.client_id as string,
    actor_id: user.id,
    event_type: openedExternal ? "file_opened" : "file_download",
    title: openedExternal ? `Opened “${file.label}”` : `Downloaded “${file.label}”`,
    meta: openedExternal ? { file_id: fileId, external: true } : { file_id: fileId },
  });
}
