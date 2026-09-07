"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bug, ImagePlus, Loader2, X } from "lucide-react";
import {
  captureDebugSnapshot,
  recordDebugRoute,
  startDebugCapture,
} from "@/lib/debug/capture";
import { uploadDebugAttachments } from "@/app/actions/debug-reports";
import type { DebugSeverity, DebugReportType } from "@/lib/debug/types";

const SEVERITIES: { id: DebugSeverity; label: string }[] = [
  { id: "blocker", label: "Blocker" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const REPORT_TYPES: { id: DebugReportType; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "enhancement", label: "Enhancement" },
];

export function DebugReporter({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [what, setWhat] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [repro, setRepro] = useState("");
  const [severity, setSeverity] = useState<DebugSeverity>("medium");
  const [reportType, setReportType] = useState<DebugReportType>("bug");
  const [location, setLocation] = useState("");
  const [tab, setTab] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const debugQuery = searchParams?.get("debug") === "1";

  useEffect(() => {
    if (!enabled) return;
    if (debugQuery) setOpen(true);
  }, [enabled, debugQuery]);

  useEffect(() => {
    if (!enabled) return;
    if (open || debugQuery) startDebugCapture();
  }, [enabled, open, debugQuery]);

  useEffect(() => {
    if (!enabled || !pathname) return;
    if (!(open || debugQuery)) return;
    const search = searchParams?.toString();
    recordDebugRoute(pathname, search ? `?${search}` : "");
  }, [enabled, open, debugQuery, pathname, searchParams]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const snap = captureDebugSnapshot();
    setLocation(snap.locationLabel || snap.href);
    setTab(snap.selectedTab || "");
    if (!title) {
      const digest = snap.digest ? `ERROR ${snap.digest}` : "";
      const hint =
        digest || [snap.selectedTab, snap.heading].filter(Boolean).join(" — ");
      if (hint) setTitle(hint.slice(0, 120));
    }
    setDone(false);
    setError("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const pasted = e.clipboardData?.files;
      if (!pasted?.length) return;
      const images = Array.from(pasted).filter((f) => f.type.startsWith("image/"));
      if (!images.length) return;
      e.preventDefault();
      setFiles((prev) => {
        const next = [...prev];
        for (const f of images) {
          if (next.length >= 5) break;
          if (f.size > 5 * 1024 * 1024) continue;
          next.push(f);
        }
        return next;
      });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open]);

  if (!enabled || pathname?.includes("/print")) return null;

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        if (next.length >= 5) break;
        if (f.size > 5 * 1024 * 1024) continue;
        next.push(f);
      }
      return next;
    });
  };

  const submit = () => {
    const snapshot = captureDebugSnapshot();
    startTransition(async () => {
      try {
        let attachments: { path: string; name: string; mime: string; size: number }[] =
          [];
        if (files.length) {
          const fd = new FormData();
          for (const f of files) fd.append("files", f);
          const up = await uploadDebugAttachments(fd);
          if (!up.ok) {
            setError(up.error);
            return;
          }
          attachments = up.attachments;
        }
        const res = await fetch("/api/debug/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            whatHappened: what,
            expected,
            actual,
            beforeExperience: before,
            afterExperience: after,
            reproSteps: repro,
            severity,
            reportType,
            snapshot,
            attachments,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; id: string }
          | { ok: false; error?: string }
          | null;
        if (!data?.ok) {
          setError(data && "error" in data && data.error ? data.error : "Could not save the report.");
          return;
        }
        setDone(true);
        setWhat("");
        setExpected("");
        setActual("");
        setBefore("");
        setAfter("");
        setRepro("");
        setReportType("bug");
        setFiles([]);
        setTimeout(() => setOpen(false), 900);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save the report.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report a bug (⌘⇧D)"
        className="fixed z-[400] right-4 bottom-20 lg:bottom-5 inline-flex items-center gap-1.5 rounded-full bg-accent text-white pl-3 pr-3.5 py-2.5 min-h-11 shadow-[0_8px_24px_rgba(0,0,0,.28)] hover:bg-accent-hover"
      >
        <Bug size={14} strokeWidth={2} />
        <span className="text-[12px] font-semibold">Report</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[410] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Report an issue"
            className="relative h-full w-full max-w-md bg-surface border-l border-border shadow-[-12px_0_40px_rgba(0,0,0,.12)] overflow-y-auto"
          >
            <div className="sticky top-0 bg-surface border-b border-border px-4 py-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Debug
                </p>
                <h2 className="text-[16px] font-semibold text-text-primary mt-0.5">
                  Report what you see
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-text-muted hover:bg-surface-raised"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-3">
              <div className="rounded-lg bg-surface-raised border border-border px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  Captured location
                </p>
                <p className="text-[12px] text-text-primary mt-0.5 break-all">
                  {location || pathname}
                </p>
                {tab ? (
                  <p className="text-[12px] text-text-secondary mt-0.5">
                    Tab (no URL): {tab}
                  </p>
                ) : null}
                <p className="text-[11px] text-text-muted mt-1">
                  URL, tab, trail, console, and failed requests are attached automatically.
                </p>
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Short title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary"
                  placeholder="Website report empty on client"
                />
              </label>

              <div className="flex flex-wrap gap-1.5">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setReportType(t.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                      reportType === t.id
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-surface text-text-secondary border-border"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSeverity(s.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
                      severity === s.id
                        ? "bg-accent text-white border-accent"
                        : "bg-surface text-text-secondary border-border"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  What went wrong
                </span>
                <textarea
                  value={what}
                  onChange={(e) => setWhat(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary resize-y"
                  placeholder="Published Website, client portal shows nothing."
                />
              </label>

              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Expected
                  </span>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary resize-y"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Actual
                  </span>
                  <textarea
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary resize-y"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    How it was before
                  </span>
                  <textarea
                    value={before}
                    onChange={(e) => setBefore(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary resize-y"
                    placeholder="Worked last week / never worked / only after X"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    How it is now
                  </span>
                  <textarea
                    value={after}
                    onChange={(e) => setAfter(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary resize-y"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Repro (optional)
                  </span>
                  <textarea
                    value={repro}
                    onChange={(e) => setRepro(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] text-text-primary resize-y"
                  />
                </label>
              </div>

              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Screenshots
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Paste or choose. Up to 5 images, 5 MB each.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-border text-[12px] font-semibold text-text-primary"
                >
                  <ImagePlus size={14} />
                  Attach images
                </button>
                {previews.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {previews.map((p, i) => (
                      <div key={p.url} className="relative">
                        <img
                          src={p.url}
                          alt=""
                          className="h-16 w-16 object-cover rounded-md border border-border"
                        />
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="text-[12px] text-danger">{error}</p>
              ) : null}
              {done ? (
                <p className="text-[12px] text-success">Saved to Debug center.</p>
              ) : null}

              <button
                type="button"
                disabled={pending || !what.trim()}
                onClick={submit}
                className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-lg bg-accent text-white text-[13px] font-semibold hover:bg-accent-hover disabled:opacity-50"
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}
                Submit with page context
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
