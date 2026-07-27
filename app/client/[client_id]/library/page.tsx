import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { createClient } from "@/utils/supabase/server";
import { publicStorageUrl } from "@/lib/storage-public-url";
import { LibraryActionButtons } from "./LibraryActionButtons";

const BUCKET = "client-vault";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);
  
  if (!access) {
    return <div className="p-8 text-zinc-500">Access Denied</div>;
  }

  const supabase = await createClient();
  const { data: files } = await supabase
    .from("vault_files")
    .select(
      "id, folder_key, category, label, storage_path, external_url, external_provider, file_name, version, created_at"
    )
    .eq("client_id", client_id)
    .eq("is_current", true)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8 px-4 page-enter">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Consolidated File Matrix</h1>
          <p className="mt-1 text-sm text-zinc-400">Aggregate spreadsheet table of every asset.</p>
        </div>
        <LibraryActionButtons clientId={client_id} />
      </header>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-zinc-900/50 text-xs font-medium uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-6 py-4 w-12"><input type="checkbox" className="accent-[#00FF00]" /></th>
                <th className="px-6 py-4">Label</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {files?.map((f) => {
                const url =
                  f.external_url ??
                  (f.storage_path ? publicStorageUrl(BUCKET, f.storage_path) : "#");
                return (
                  <tr key={f.id} className="transition-colors hover:bg-zinc-900/50">
                    <td className="px-6 py-4"><input type="checkbox" className="accent-[#00FF00]" /></td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-200">{f.label || f.file_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        {f.category || "General"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-300">
                      {f.external_provider || (f.storage_path ? "Local" : "Unknown")}
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#00FF00] hover:underline"
                      >
                        {f.external_url ? "Open Link" : "Download"}
                      </a>
                    </td>
                  </tr>
                );
              })}
              {!files || files.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                    No files found in this workspace.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
