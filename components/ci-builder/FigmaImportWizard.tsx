"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Layers,
  Loader2,
  Link2,
  FolderOpen,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Unplug,
} from "lucide-react";

type ConnectionInfo = {
  connected: true;
  authMethod: "oauth" | "pat";
  figmaHandle: string | null;
  figmaEmail: string | null;
  expiresAt?: string | null;
} | null;

type ProjectRow = { id: string; name: string };
type FileRow = {
  key: string;
  name: string;
  thumbnailUrl?: string | null;
  lastModified?: string | null;
};

type FigmaImportWizardProps = {
  guidelineId: string;
  projectId: string;
  linkedFigma?: {
    fileKey: string | null;
    fileName: string | null;
    version: string | null;
    lastImportedAt: string | null;
  } | null;
  onClose: () => void;
  onImported: (result: {
    sections: any[];
    assets: any[];
    theme: any;
    report: any;
    figma?: { fileKey?: string; fileName?: string; version?: string };
  }) => void;
};

export function FigmaImportWizard({
  guidelineId,
  projectId,
  linkedFigma,
  onClose,
  onImported,
}: FigmaImportWizardProps) {
  const [loading, setLoading] = useState(true);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [connection, setConnection] = useState<ConnectionInfo>(null);
  const [pat, setPat] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [teamInput, setTeamInput] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectIdSelected, setProjectIdSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileUrl, setFileUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileRow | null>(null);

  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [syncInfo, setSyncInfo] = useState<any>(null);

  const returnTo = `/app/projects/${projectId}/ci-builder`;

  async function refreshStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ci-builder/figma/connection");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load connection");
      setOauthConfigured(Boolean(data.oauthConfigured));
      setConnection(data.connection);

      if (data.connection && linkedFigma?.fileKey) {
        const syncRes = await fetch(
          `/api/ci-builder/figma/sync?guidelineId=${encodeURIComponent(guidelineId)}`
        );
        const syncData = await syncRes.json();
        if (syncRes.ok) setSyncInfo(syncData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("figma_connected") === "1") {
      // Clean query after OAuth redirect
      const url = new URL(window.location.href);
      url.searchParams.delete("figma_connected");
      url.searchParams.delete("figma_error");
      window.history.replaceState({}, "", url.toString());
    }
    const figmaErr = params.get("figma_error");
    if (figmaErr) setError(decodeURIComponent(figmaErr));
  }, []);

  async function connectPat() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ci-builder/figma/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalAccessToken: pat }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PAT connect failed");
      setConnection(data.connection);
      setPat("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/ci-builder/figma/connection", { method: "DELETE" });
      setConnection(null);
      setProjects([]);
      setFiles([]);
      setSelectedFile(null);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function loadProjects() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ci-builder/figma/projects?team_url=${encodeURIComponent(teamInput)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projects");
      setTeamId(data.teamId);
      setProjects(data.projects || []);
      setProjectIdSelected(null);
      setFiles([]);
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadFiles(pid: string) {
    setBusy(true);
    setError(null);
    setProjectIdSelected(pid);
    try {
      const res = await fetch(
        `/api/ci-builder/figma/files?project_id=${encodeURIComponent(pid)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load files");
      setFiles(data.files || []);
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resolveFileUrl() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ci-builder/figma/files?file_url=${encodeURIComponent(fileUrl)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid file URL");
      setSelectedFile(data.file);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    if (!selectedFile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ci-builder/figma/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidelineId,
          fileKey: selectedFile.key,
          teamId,
          projectId: projectIdSelected,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!selectedFile) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ci-builder/figma/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidelineId,
          fileKey: selectedFile.key,
          teamId,
          projectId: projectIdSelected,
          previewOnly: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      onImported({
        sections: data.sections || [],
        assets: data.assets || [],
        theme: data.theme || {},
        report: data.report,
        figma: data.figma,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runSync(force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ci-builder/figma/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidelineId, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      if (data.skipped) {
        setSyncInfo((s: any) => ({ ...s, ...data.diff, changed: false }));
        setError(null);
        alert(data.message || "Already up to date");
        return;
      }
      onImported({
        sections: data.sections || [],
        assets: data.assets || [],
        theme: data.theme || {},
        report: data.report,
        figma: {
          fileKey: linkedFigma?.fileKey || undefined,
          fileName: data.diff?.fileName,
          version: data.diff?.currentVersion,
        },
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Connect to Figma</h3>
              <p className="text-[11px] text-gray-500">
                Import colors, type, components &amp; assets into CI Builder
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-start gap-2 text-[12px] text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : !connection ? (
            <div className="space-y-4">
              {oauthConfigured ? (
                <a
                  href={`/api/ci-builder/figma/oauth/start?return_to=${encodeURIComponent(returnTo)}&guideline_id=${encodeURIComponent(guidelineId)}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
                >
                  <Link2 className="w-4 h-4" />
                  Continue with Figma OAuth
                </a>
              ) : (
                <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  OAuth is not configured yet. Add{" "}
                  <code className="font-mono text-[11px]">FIGMA_CLIENT_ID</code>{" "}
                  and{" "}
                  <code className="font-mono text-[11px]">FIGMA_CLIENT_SECRET</code>{" "}
                  — or paste a Personal Access Token below to test.
                </p>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="figd_…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-gray-400">
                  Create at Figma → Settings → Security → Personal access tokens.
                  Include file content, metadata, projects, current user, and variables
                  (if on Enterprise).
                </p>
                <button
                  type="button"
                  disabled={!pat || busy}
                  onClick={connectPat}
                  className="w-full py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {busy ? "Connecting…" : "Connect with PAT"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 text-[12px] text-emerald-800">
                  <CheckCircle2 className="w-4 h-4" />
                  Connected as{" "}
                  <strong>
                    {connection.figmaHandle || connection.figmaEmail || "Figma user"}
                  </strong>{" "}
                  <span className="text-emerald-600/80">
                    ({connection.authMethod})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={disconnect}
                  className="text-[11px] text-emerald-800 hover:underline flex items-center gap-1"
                >
                  <Unplug className="w-3 h-3" /> Disconnect
                </button>
              </div>

              {linkedFigma?.fileKey && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-3 space-y-2">
                  <p className="text-[12px] font-semibold text-indigo-900">
                    Linked file — sync (P6)
                  </p>
                  <p className="text-[12px] text-indigo-800">
                    {linkedFigma.fileName || linkedFigma.fileKey}
                    {linkedFigma.version ? (
                      <span className="text-indigo-600/80 font-mono text-[10px] ml-2">
                        v{linkedFigma.version}
                      </span>
                    ) : null}
                  </p>
                  {syncInfo?.changed && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                      Newer version available in Figma
                      {syncInfo.currentVersion
                        ? ` (v${syncInfo.currentVersion})`
                        : ""}
                      .
                    </p>
                  )}
                  {syncInfo && !syncInfo.changed && syncInfo.linked && (
                    <p className="text-[11px] text-indigo-700">Up to date with Figma.</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runSync(false)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50"
                    >
                      Sync from Figma
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => runSync(true)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-800 text-xs font-medium disabled:opacity-50"
                    >
                      Force re-import
                    </button>
                  </div>
                </div>
              )}

              {/* Browse by team */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                  <FolderOpen className="w-3.5 h-3.5" /> Team URL or ID
                </label>
                <div className="flex gap-2">
                  <input
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value)}
                    placeholder="https://www.figma.com/files/team/…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!teamInput || busy}
                    onClick={loadProjects}
                    className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium disabled:opacity-50"
                  >
                    Load
                  </button>
                </div>
                {projects.length > 0 && (
                  <div className="border border-gray-100 rounded-xl divide-y max-h-36 overflow-y-auto">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => loadFiles(p.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          projectIdSelected === p.id ? "bg-blue-50 text-blue-800" : ""
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                {files.length > 0 && (
                  <div className="border border-gray-100 rounded-xl divide-y max-h-40 overflow-y-auto">
                    {files.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setSelectedFile(f)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          selectedFile?.key === f.key ? "bg-blue-50 text-blue-800" : ""
                        }`}
                      >
                        <span className="font-medium">{f.name}</span>
                        {f.lastModified && (
                          <span className="block text-[10px] text-gray-400">
                            {new Date(f.lastModified).toLocaleString()}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Or paste file URL */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Or paste file URL
                </label>
                <div className="flex gap-2">
                  <input
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://www.figma.com/design/…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!fileUrl || busy}
                    onClick={resolveFileUrl}
                    className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium disabled:opacity-50"
                  >
                    Use
                  </button>
                </div>
              </div>

              {selectedFile && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-[12px] text-blue-900">
                  Selected: <strong>{selectedFile.name}</strong>
                  <span className="text-blue-700/70 font-mono text-[10px] ml-2">
                    {selectedFile.key}
                  </span>
                </div>
              )}

              {preview && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2 text-[12px]">
                  <p className="font-semibold text-gray-800">
                    Preview — {preview.summary?.fileName}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-gray-600">
                    <span>{preview.summary?.pageCount} pages</span>
                    <span>{preview.summary?.frameCount} frames</span>
                    <span>{preview.summary?.componentCount} components</span>
                    <span>{preview.summary?.styleCount} styles</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      {preview.report?.mapped ?? 0} mapped
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                      {preview.report?.suggested ?? 0} suggested
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                      {preview.report?.unmapped ?? 0} unmapped
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Full import maps colors, typography, buttons, logos,
                    backgrounds, frames, applications, and do/don&apos;ts — then
                    exports images into shared assets.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {connection && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!selectedFile || busy}
              onClick={runPreview}
              className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? "Working…" : "Preview"}
            </button>
            <button
              type="button"
              disabled={!selectedFile || busy}
              onClick={runImport}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Import into CI Builder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
