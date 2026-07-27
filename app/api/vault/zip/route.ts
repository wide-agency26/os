import archiver from "archiver";
import { NextResponse } from "next/server";
import { getSupabaseUrl } from "@/utils/supabase/env";
import { getWorkspaceClientId } from "@/lib/workspace";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function safeZipName(label: string, fileName: string, index: number) {
  const base = `${index + 1}-${label}-${fileName}`.replace(/[/\\?%*:|"<>]/g, "-");
  return base.slice(0, 180);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceClientId(supabase, user.id);
  const { data: files, error } = await supabase
    .from("vault_files")
    .select("label, file_name, storage_path, external_url")
    .eq("client_id", workspaceId)
    .eq("is_current", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!files?.length) {
    return NextResponse.json({ error: "No files in your vault yet." }, { status: 404 });
  }

  const packable = files.filter(
    (f) => typeof f.storage_path === "string" && f.storage_path.length > 0 && !f.external_url
  );

  if (!packable.length) {
    return NextResponse.json(
      {
        error:
          "No uploaded files to zip — only Google / external links are listed. Download those items from Drive.",
      },
      { status: 404 }
    );
  }

  const base = getSupabaseUrl().replace(/\/$/, "");
  const archive = archiver("zip", { zlib: { level: 6 } });
  const buffers: Buffer[] = [];

  const bufPromise = new Promise<Buffer>((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => buffers.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(buffers)));
    archive.on("error", reject);
  });

  let index = 0;
  for (const f of packable) {
    const enc = f.storage_path!.split("/").map(encodeURIComponent).join("/");
    const url = `${base}/storage/v1/object/public/client-vault/${enc}`;
    const res = await fetch(url);
    if (!res.ok) {
      index += 1;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    archive.append(buf, { name: safeZipName(f.label || "", f.file_name || "", index) });
    index += 1;
  }

  await archive.finalize();
  const out = await bufPromise;

  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="wide-vault-${workspaceId.slice(0, 8)}.zip"`,
    },
  });
}
