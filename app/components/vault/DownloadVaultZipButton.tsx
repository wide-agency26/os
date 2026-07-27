"use client";

import { useState } from "react";

export function DownloadVaultZipButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/vault/zip");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(typeof j.error === "string" ? j.error : "Could not build zip.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "wide-vault.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="px-4 py-2 rounded-lg border border-accent/40 bg-accent/10 text-accent text-sm font-medium hover:bg-accent/15 disabled:opacity-50"
      >
        {busy ? "Zipping…" : "Download uploaded files (zip)"}
      </button>
      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
    </div>
  );
}
