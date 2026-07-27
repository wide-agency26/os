import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { publicStorageUrl } from "@/lib/storage-public-url";
import { VaultDownloadButton } from "@/app/components/vault/VaultDownloadButton";
import { DownloadVaultZipButton } from "@/app/components/vault/DownloadVaultZipButton";
import type { WideAccess } from "@/lib/wide-os/types";
import { ModuleScaffold } from "@/modules/_shared/ModuleScaffold";

const BUCKET = "client-vault";

export async function ClientFilesReadView({ access }: { access: WideAccess }) {
  const clientId = access.clientId!;
  const supabase = await createClient();

  const { data: fileRows, error } = await supabase
    .from("vault_files")
    .select(
      "id, folder_key, category, label, storage_path, external_url, external_provider, file_name, version, is_legal, created_at"
    )
    .eq("client_id", clientId)
    .eq("is_current", true)
    .order("created_at", { ascending: false });

  const files = fileRows ?? [];

  return (
    <ModuleScaffold access={access} title="Files & assets" description="Secure downloads and Google Drive links.">
      <DownloadVaultZipButton />
      {error ? <p className="text-sm text-danger mt-4">{error.message}</p> : null}
      {files.length === 0 ? (
        <p className="text-sm text-text-secondary mt-4">No files published yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {files.map((f) => {
            const url =
              f.external_url ??
              (f.storage_path ? publicStorageUrl(BUCKET, f.storage_path) : "#");
            return (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <span className="text-sm font-medium text-text-primary">{f.label}</span>
                <VaultDownloadButton fileId={f.id} href={url}>
                  {f.external_url ? "Open" : "Download"}
                </VaultDownloadButton>
              </li>
            );
          })}
        </ul>
      )}
    </ModuleScaffold>
  );
}
