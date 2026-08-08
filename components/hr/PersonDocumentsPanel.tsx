"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Download, Trash, Upload } from "lucide-react";
import { HR_DOC_TYPES, type HrDocType } from "@/lib/hr/types";

type HrDoc = {
  id: string;
  person_id: string;
  doc_type: HrDocType;
  file_path: string;
  file_name: string | null;
  file_url: string | null;
  uploaded_at: string;
};

type Props = {
  personId: string;
  onDocsChange?: (docs: HrDoc[]) => void;
};

const BUCKET = "hr-roster-docs";

export function PersonDocumentsPanel({ personId, onDocsChange }: Props) {
  const [docs, setDocs] = useState<HrDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<HrDocType>("contract");
  const onDocsChangeRef = useRef(onDocsChange);
  onDocsChangeRef.current = onDocsChange;

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("hr_documents")
      .select("*")
      .eq("person_id", personId)
      .order("uploaded_at", { ascending: false });
    if (error) {
      console.error(error);
      setDocs([]);
      onDocsChangeRef.current?.([]);
    } else {
      const rows = (data || []) as HrDoc[];
      setDocs(rows);
      onDocsChangeRef.current?.(rows);
    }
    setLoading(false);
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${personId}/${crypto.randomUUID()}-${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined });

    if (upErr) {
      setUploading(false);
      alert("Upload failed: " + upErr.message);
      return;
    }

    const { error: insErr } = await (supabase as any).from("hr_documents").insert([
      {
        person_id: personId,
        doc_type: docType,
        file_path: path,
        file_name: file.name,
      },
    ]);

    setUploading(false);
    if (insErr) {
      alert("Failed to save document row: " + insErr.message);
      return;
    }
    await load();
  };

  const handleDownload = async (doc: HrDoc) => {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 60 * 10);
    if (error || !data?.signedUrl) {
      alert("Could not create download link: " + (error?.message || "unknown"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (doc: HrDoc) => {
    if (!confirm(`Delete ${doc.file_name || "this document"}?`)) return;
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([doc.file_path]);
    const { error } = await (supabase as any)
      .from("hr_documents")
      .delete()
      .eq("id", doc.id);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    await load();
  };

  const typeLabel = (t: HrDocType) =>
    HR_DOC_TYPES.find((x) => x.value === t)?.label || t;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[13px] font-bold text-gray-900">Documents</h3>
        <div className="flex items-center gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as HrDocType)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px]"
          >
            {HR_DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium hover:bg-blue-700 cursor-pointer">
            <Upload size={14} />
            {uploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                e.target.value = "";
                void handleUpload(f);
              }}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-500">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-[13px] text-gray-500">No documents uploaded yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">File</th>
                <th className="text-left px-3 py-2">Uploaded</th>
                <th className="text-right px-3 py-2 w-24"> </th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-gray-50">
                  <td className="px-3 py-2 text-gray-800">{typeLabel(d.doc_type)}</td>
                  <td className="px-3 py-2 text-gray-700 truncate max-w-[220px]">
                    {d.file_name || d.file_path}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {d.uploaded_at
                      ? new Date(d.uploaded_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDownload(d)}
                      className="p-1.5 text-gray-500 hover:text-blue-600"
                      aria-label="Download"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(d)}
                      className="p-1.5 text-gray-500 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
