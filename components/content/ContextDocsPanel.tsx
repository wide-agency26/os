"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { ContextDoc } from "@/lib/content/types";
import { Button } from "@/components/frappe-ui/primitives";

type ApiResult = { ok: boolean; error?: string; path?: string; token?: string; mimeType?: string };

async function callContextDocs(body: Record<string, unknown>): Promise<ApiResult> {
  const res = await fetch("/api/content/context-docs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiResult | null;
  if (!json) {
    return { ok: false, error: `Upload failed (${res.status}). Stay on this page and try again.` };
  }
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error || `Upload failed (${res.status}).` };
  }
  return json;
}

export function ContextDocsPanel({
  projectId,
  docs,
}: {
  projectId: string;
  docs: ContextDoc[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, okMsg?: string) {
    setMsg(null);
    setBusy(true);
    try {
      const res = await callContextDocs(body);
      if (!res.ok) setMsg(res.error || "Failed");
      else {
        if (okMsg) setMsg(okMsg);
        router.refresh();
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadContextFile(file: File) {
    setMsg(null);
    if (file.size > 50 * 1024 * 1024) {
      setMsg("File is over 50 MB.");
      return;
    }
    setBusy(true);
    try {
      const prepared = await callContextDocs({
        action: "prepare",
        projectId,
        filename: file.name,
        mimeType: file.type || null,
        size: file.size,
      });
      if (!prepared.ok || !prepared.path || !prepared.token) {
        setMsg(prepared.error || "Could not start upload.");
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("content-context")
        .uploadToSignedUrl(prepared.path, prepared.token, file, {
          contentType: prepared.mimeType,
        });
      if (upErr) {
        setMsg(upErr.message);
        return;
      }
      const done = await callContextDocs({
        action: "finalize",
        projectId,
        path: prepared.path,
        filename: file.name,
        mimeType: prepared.mimeType,
      });
      if (!done.ok) setMsg(done.error || "Could not save the file.");
      else {
        setMsg("Uploaded");
        router.refresh();
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed. Your proposal is still here.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Research documents
        </p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.md,.csv,.docx,.doc,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void uploadContextFile(file);
          }}
        />
      </div>
      <p className="text-[12px] text-text-muted">
        Shared with Content Calendar. PDF, TXT, MD, CSV, DOCX, or images up to 50 MB.
      </p>
      {msg ? <p className="text-[13px] text-text-secondary">{msg}</p> : null}
      {docs.length === 0 ? (
        <p className="text-[13px] text-text-secondary border border-dashed border-border rounded-lg px-4 py-4">
        No research on this project yet. Analyzers read these files when you generate.
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text-primary truncate">{d.filename}</p>
                <p className="text-[11px] text-text-muted">
                  {(d.extracted_text || "").length.toLocaleString()} chars extracted
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[12px] text-text-secondary inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={d.active}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        {
                          action: "toggle",
                          projectId,
                          id: d.id,
                          active: e.target.checked,
                        }
                      )
                    }
                  />
                  Active
                </label>
                <button
                  type="button"
                  className="text-[12px] text-red-700"
                  disabled={busy}
                  onClick={() =>
                    void run({ action: "remove", projectId, id: d.id }, "Removed")
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
