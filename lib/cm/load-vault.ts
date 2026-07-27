import { createClient } from "@/utils/supabase/server";

export type VaultFileRow = {
  id: string;
  folder_key: string;
  category: string;
  label: string;
  storage_path: string | null;
  external_url: string | null;
  external_provider: string | null;
  file_name: string;
  version: number;
  is_current: boolean;
  is_legal: boolean;
  created_at: string;
};

export type VaultReceipt = { at: string; who: string };

export type VaultWorkspaceData = {
  clientId: string;
  clientLabel: string;
  files: VaultFileRow[];
  vaultError: string | null;
  receipts: Map<string, VaultReceipt[]>;
  currentForUpload: { id: string; label: string; version: number }[];
};

export async function loadVaultWorkspace(clientId: string): Promise<VaultWorkspaceData | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name, role")
    .eq("id", clientId)
    .maybeSingle();

  if (!profile || profile.role !== "client") return null;

  const clientLabel = profile.full_name?.trim() || profile.company_name?.trim() || "Client";

  const { data, error } = await supabase
    .from("vault_files")
    .select(
      "id, folder_key, category, label, storage_path, external_url, external_provider, file_name, version, is_current, is_legal, created_at"
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const files = (data as VaultFileRow[]) ?? [];
  const receipts = new Map<string, VaultReceipt[]>();

  const ids = files.map((f) => f.id);
  if (ids.length > 0) {
    const { data: dls } = await supabase
      .from("vault_downloads")
      .select("file_id, downloaded_at, user_id")
      .in("file_id", ids)
      .order("downloaded_at", { ascending: false });

    const userIds = [...new Set((dls ?? []).map((d) => d.user_id))];
    let names = new Map<string, string>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      names = new Map((profs ?? []).map((p) => [p.id, p.full_name?.trim() || "User"]));
    }

    for (const row of dls ?? []) {
      const list = receipts.get(row.file_id) ?? [];
      if (list.length < 6) {
        list.push({
          at: row.downloaded_at as string,
          who: names.get(row.user_id as string) ?? "User",
        });
        receipts.set(row.file_id, list);
      }
    }
  }

  const currentForUpload = files
    .filter((f) => f.is_current)
    .map((f) => ({ id: f.id, label: f.label, version: f.version }));

  return {
    clientId,
    clientLabel,
    files,
    vaultError: error?.message ?? null,
    receipts,
    currentForUpload,
  };
}

export function vaultFolderTitle(key: string) {
  const map: Record<string, string> = {
    legal: "Contracts & invoices",
    "final-assets": "Final assets",
    strategy: "Strategy",
    wireframes: "Phase 1: Wireframes",
    general: "General",
  };
  return map[key] ?? key;
}
