"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Upload } from "lucide-react";
import { saveBdDiscoveryCall } from "@/app/actions/bd";
import { createClient } from "@/utils/supabase/client";
import {
  DISCOVERY_CONSENT_LINE,
  mergeDiscoveryCall,
  type DiscoveryCallPayload,
} from "@/lib/bd/discovery";

const BUCKET = "bd-discovery";

export function BdDiscoveryPanel({
  recordId,
  companyName,
  initial,
}: {
  recordId: string;
  companyName: string;
  initial: Record<string, unknown> | null | undefined;
}) {
  const router = useRouter();
  const [data, setData] = useState<DiscoveryCallPayload>(
    mergeDiscoveryCall(initial)
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File, kind: "notes" | "audio") {
    setUploading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${recordId}/${kind}_${Date.now()}_${safe}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (kind === "notes") {
        setData((d) => ({
          ...d,
          notes_file_url: pub.publicUrl,
          notes_file_name: file.name,
        }));
      } else {
        setData((d) => ({
          ...d,
          audio_file_url: pub.publicUrl,
          audio_file_name: file.name,
        }));
      }
      setMessage(`${kind === "notes" ? "Notes file" : "Audio"} uploaded.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function save(processAi: boolean) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveBdDiscoveryCall({
        id: recordId,
        notes_text: data.notes_text,
        notes_file_url: data.notes_file_url,
        notes_file_name: data.notes_file_name,
        audio_file_url: data.audio_file_url,
        audio_file_name: data.audio_file_name,
        transcript: data.transcript,
        processAi,
      });
      if (!res.ok) {
        setMessage(res.error || "Save failed");
        return;
      }
      setMessage(
        processAi
          ? "Processed — summary & signals saved to the record."
          : "Discovery capture saved."
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Discovery call
        </h2>
        <p className="text-[11px] text-gray-500 mt-1">
          Capture notes or a recording for {companyName}. Consent disclosure is
          always on by design.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-1">
        <p className="font-semibold">Pre-call disclosure (always included)</p>
        <p>{DISCOVERY_CONSENT_LINE}</p>
        <p className="text-amber-800/80">
          Copy this into the calendar invite / briefing.{" "}
          <code className="text-[10px]">consent_disclosed</code> is stored as
          true on every save. If AI Gateway is unavailable, summary/signals fall
          back to note heuristics (still usable for Proposal Builder).
        </p>
      </div>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Meeting notes
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[100px]"
          value={data.notes_text || ""}
          onChange={(e) => setData({ ...data, notes_text: e.target.value })}
          placeholder="Paste notes from the call…"
        />
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Upload notes doc
          <input
            type="file"
            accept=".txt,.pdf,.doc,.docx,text/plain"
            className="block w-full text-xs"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f, "notes");
            }}
          />
          {data.notes_file_name && (
            <a
              href={data.notes_file_url || "#"}
              className="text-[11px] text-blue-700"
              target="_blank"
              rel="noreferrer"
            >
              {data.notes_file_name}
            </a>
          )}
        </label>
        <label className="block space-y-1 text-xs font-medium text-gray-700">
          Upload call recording
          <input
            type="file"
            accept="audio/*"
            className="block w-full text-xs"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f, "audio");
            }}
          />
          {data.audio_file_name && (
            <a
              href={data.audio_file_url || "#"}
              className="text-[11px] text-blue-700"
              target="_blank"
              rel="noreferrer"
            >
              {data.audio_file_name}
            </a>
          )}
        </label>
      </div>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Transcript (auto-filled after process if Whisper succeeds; editable)
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[80px] font-mono"
          value={data.transcript || ""}
          onChange={(e) => setData({ ...data, transcript: e.target.value })}
          placeholder="Or paste transcript manually…"
        />
      </label>

      {(data.summary || data.action_items.length > 0) && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 space-y-2">
          {data.summary && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500">Summary</p>
              <p className="text-sm text-gray-800 mt-0.5">{data.summary}</p>
            </div>
          )}
          {data.action_items.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500">
                Action items
              </p>
              <ul className="list-disc pl-4 text-sm text-gray-800 mt-0.5">
                {data.action_items.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-700">
            <p>
              <span className="font-semibold">Needs:</span> {data.needs || "—"}
            </p>
            <p>
              <span className="font-semibold">Budget:</span> {data.budget || "—"}
            </p>
            <p>
              <span className="font-semibold">Timeline:</span>{" "}
              {data.timeline || "—"}
            </p>
          </div>
        </div>
      )}

      {message && (
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || uploading}
          onClick={() => save(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Save capture
        </button>
        <button
          type="button"
          disabled={pending || uploading}
          onClick={() => save(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
          Transcribe / summarize
        </button>
      </div>
    </section>
  );
}
