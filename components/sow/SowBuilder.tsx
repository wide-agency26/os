"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  CopyPlus,
  FolderOpen,
  Layers,
  Loader2,
  MoreHorizontal,
  Printer,
  Trash2,
} from "lucide-react";
import type { SowDocument, PmService, SowPortfolioSlide, SowTheme, SowVat } from "@/lib/sow/types";
import { SowDocumentView } from "@/components/sow/SowDocumentView";
import {
  addCustomSection,
  addPackageToSow,
  addPortfolioSlide,
  addServiceToSow,
  deleteLineItem,
  deletePortfolioSlide,
  deleteSow,
  duplicateSow,
  featurePortfolioSlide,
  setSowStatus,
  updatePortfolioSlide,
  updateSection,
  updateSowMeta,
  upsertLineItem,
} from "@/app/actions/sow";
import {
  applySowSuggestions,
  listBdRecordsForSow,
  listReusablePortfolioSlides,
  mergeSowSections,
  proposeSowFromContext,
  reusePortfolioSlide,
  rewriteSowField,
  saveSowAssistContext,
  skipSowSuggestions,
  unmergeSowSection,
} from "@/app/actions/sow-assist";
import {
  SOW_STATUS_LABELS,
  computeSowSubtotal,
  formatSowMoney,
  resolveSowTheme,
} from "@/lib/sow/constants";
import { emptySowAssistContext, type SowAssistContext } from "@/lib/sow/assist";
import { isFrozenSowSlug } from "@/lib/sow/frozen";
import { workPaths } from "@/lib/work/paths";
import { ContextBar } from "@/components/sow/builder/ContextBar";
import { ScopeList } from "@/components/sow/builder/ScopeList";
import { CopyPane } from "@/components/sow/builder/CopyPane";
import { DealPane, uploadSowScreenshot } from "@/components/sow/builder/DealPane";
import { sanitizePortfolioTitle, withFeaturedSlide } from "@/lib/sow/portfolio";

function absoluteShare(path: string) {
  if (path.startsWith("http")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function SowBuilder({
  initial,
  services,
  packages: packagesProp = [],
  versions = [],
}: {
  initial: SowDocument;
  services: PmService[];
  packages?: { id: string; name: string }[];
  versions?: { id: string; title: string; version_number: number; status: string }[];
}) {
  const router = useRouter();
  const [sow, setSow] = useState(initial);
  const [versionList, setVersionList] = useState(versions);
  const [packages, setPackages] = useState(packagesProp);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | "hero">("hero");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergePrice, setMergePrice] = useState("");
  const [bdRecords, setBdRecords] = useState<{ id: string; label: string }[]>([]);
  const [reuseSlides, setReuseSlides] = useState<
    Awaited<ReturnType<typeof listReusablePortfolioSlides>>["slides"]
  >([]);
  const [shareUrl, setShareUrl] = useState<string | null>(
    initial.public_slug ? `/s/${initial.public_slug}` : null
  );
  const locked = isFrozenSowSlug(sow.public_slug);
  const context: SowAssistContext = sow.assist_context || emptySowAssistContext();
  const suggestions = context.pending_suggestions || [];
  const subtotal = computeSowSubtotal(sow);

  useEffect(() => {
    setShareUrl(initial.public_slug ? `/s/${initial.public_slug}` : null);
    setSow((prev) => {
      if (prev.id !== initial.id) return initial;
      const localIds = prev.portfolio_slides.map((s) => s.id).join(",");
      const serverIds = initial.portfolio_slides.map((s) => s.id).join(",");
      if (localIds !== serverIds) {
        return { ...initial, portfolio_slides: prev.portfolio_slides };
      }
      return initial;
    });
  }, [initial]);

  useEffect(() => {
    setVersionList(versions);
  }, [versions]);

  useEffect(() => {
    setPackages(packagesProp);
  }, [packagesProp]);

  useEffect(() => {
    void listBdRecordsForSow().then((r) => {
      if (r.ok) setBdRecords(r.records);
    });
    void listReusablePortfolioSlides().then((r) => {
      if (r.ok) setReuseSlides(r.slides);
    });
  }, []);

  async function reloadSow() {
    const payload = (await fetch(
      `/api/sow/builder?sowId=${encodeURIComponent(sow.id)}`,
      { cache: "no-store" }
    ).then((r) => r.json())) as {
      ok?: boolean;
      sow?: SowDocument;
      versions?: typeof versions;
      packages?: { id: string; name: string }[];
    };
    if (!payload.ok || !payload.sow) return false;
    setSow(payload.sow);
    if (payload.versions) setVersionList(payload.versions);
    if (payload.packages) setPackages(payload.packages);
    if (payload.sow.public_slug) setShareUrl(`/s/${payload.sow.public_slug}`);
    return true;
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    setPending(true);
    void (async () => {
      try {
        const res = await fn();
        if (!res.ok) setMessage(res.error || "Something went wrong");
        else setMessage(label);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setPending(false);
      }
    })();
  }

  function addSlideToPreview(slide: SowPortfolioSlide) {
    setSow((prev) => {
      if (prev.portfolio_slides.some((s) => s.id === slide.id)) return prev;
      return { ...prev, portfolio_slides: [...prev.portfolio_slides, slide] };
    });
  }

  const activeSection =
    activeId === "hero" ? null : sow.sections.find((s) => s.id === activeId) || null;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-var(--os-header)-var(--os-bottom-nav))] bg-white overflow-x-hidden">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            SOW Builder · {SOW_STATUS_LABELS[sow.status] || sow.status}
            {locked ? " · locked" : ""}
            {versionList.length > 1
              ? ` · v${sow.version_number ?? 1} of ${versionList.length}`
              : sow.version_number && sow.version_number > 1
                ? ` · v${sow.version_number}`
                : ""}
          </p>
          <input
            className="mt-0.5 w-full max-w-xl text-lg font-semibold text-gray-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
            value={sow.title}
            disabled={locked}
            onChange={(e) => setSow({ ...sow, title: e.target.value })}
            onBlur={() =>
              run("Title saved", () =>
                updateSowMeta({ sowId: sow.id, title: sow.title })
              )
            }
          />
          {versionList.length > 1 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {versionList.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    if (v.id !== sow.id) router.push(workPaths.sowId(v.id));
                  }}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    v.id === sow.id
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  v{v.version_number}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 mr-1">
            {formatSowMoney(subtotal, sow.currency)}
          </p>
          {sow.project_id && (
            <Link
              href={`/app/projects/${sow.project_id}/sow`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
            >
              <FolderOpen size={14} /> Open project
            </Link>
          )}
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-xs">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md ${tab === "edit" ? "bg-gray-900 text-white" : "text-gray-600"}`}
              onClick={() => setTab("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md ${tab === "preview" ? "bg-gray-900 text-white" : "text-gray-600"}`}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>
          {sow.status === "draft" ? (
            <button
              type="button"
              disabled={pending || locked}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() =>
                run("Published", async () => {
                  const res = await setSowStatus({ sowId: sow.id, status: "published" });
                  if (res.ok) {
                    setSow({
                      ...sow,
                      status: "published",
                      public_slug: res.publicSlug || sow.public_slug,
                    });
                    if (res.shareUrl) {
                      setShareUrl(res.shareUrl);
                      try {
                        await navigator.clipboard.writeText(absoluteShare(res.shareUrl));
                      } catch {
                        /* ignore */
                      }
                    }
                  }
                  return res;
                })
              }
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Publish
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || locked}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50"
              onClick={() =>
                run("Unpublished", async () => {
                  const res = await setSowStatus({ sowId: sow.id, status: "draft" });
                  if (res.ok) setSow({ ...sow, status: "draft" });
                  return res;
                })
              }
            >
              Revert to draft
            </button>
          )}
          <details className="relative">
            <summary className="list-none cursor-pointer rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
              <MoreHorizontal size={16} />
            </summary>
            <div className="absolute right-0 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg p-1 z-30 text-xs">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 inline-flex items-center gap-1.5"
                onClick={() => window.open(workPaths.sowPrint(sow.id), "_blank")}
              >
                <Printer size={12} /> PDF / Print
              </button>
              {shareUrl && (
                <button
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 inline-flex items-center gap-1.5"
                  onClick={async () => {
                    const url = absoluteShare(shareUrl);
                    try {
                      await navigator.clipboard.writeText(url);
                      setMessage(`Copied ${url}`);
                    } catch {
                      setMessage(url);
                    }
                  }}
                >
                  <Copy size={12} /> Copy share URL
                </button>
              )}
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 inline-flex items-center gap-1.5"
                onClick={() =>
                  run("New version drafted", async () => {
                    const res = await duplicateSow(sow.id, { asVersion: true });
                    if (res.ok && res.sowId) router.push(workPaths.sowId(res.sowId));
                    return res;
                  })
                }
              >
                <Layers size={12} /> New version
              </button>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 inline-flex items-center gap-1.5"
                onClick={() =>
                  run("Duplicated as draft", async () => {
                    const res = await duplicateSow(sow.id);
                    if (res.ok && res.sowId) router.push(workPaths.sowId(res.sowId));
                    return res;
                  })
                }
              >
                <CopyPlus size={12} /> Duplicate as draft
              </button>
              <button
                type="button"
                disabled={locked}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-red-50 text-red-700 inline-flex items-center gap-1.5 disabled:opacity-40"
                onClick={() => {
                  if (!window.confirm(`Delete SOW “${sow.title}”?`)) return;
                  run("Deleted", async () => {
                    const res = await deleteSow(sow.id);
                    if (res.ok) router.push(workPaths.sow);
                    return res;
                  });
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </details>
        </div>
      </div>

      {locked && (
        <div className="px-4 py-2 text-xs bg-amber-50 border-b border-amber-200 text-amber-900">
          This SOW is locked because it was already shared with the client. Create a{" "}
          <strong>new version</strong> to send an updated draft without changing this link.
        </div>
      )}
      {message && (
        <div className="px-4 py-2 text-xs bg-gray-50 border-b border-gray-200 text-gray-700">
          {message}
        </div>
      )}

      {tab === "preview" ? (
        <div className="flex flex-col min-h-0">
          <div className="sticky top-[57px] z-10 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
            {sow.project_id && (
              <Link
                href={`/app/projects/${sow.project_id}/sow`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <FolderOpen size={12} /> Open project
              </Link>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
              onClick={() => window.open(workPaths.sowPrint(sow.id), "_blank")}
            >
              <Printer size={12} /> PDF / Print
            </button>
            {shareUrl && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={async () => {
                  const url = absoluteShare(shareUrl);
                  try {
                    await navigator.clipboard.writeText(url);
                    setMessage(`Copied ${url}`);
                  } catch {
                    setMessage(url);
                  }
                }}
              >
                <Copy size={12} /> Copy share URL
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              onClick={() =>
                run("New version drafted", async () => {
                  const res = await duplicateSow(sow.id, { asVersion: true });
                  if (res.ok && res.sowId) router.push(workPaths.sowId(res.sowId));
                  return res;
                })
              }
            >
              <Layers size={12} /> New version
            </button>
            <button
              type="button"
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              onClick={() =>
                run("Duplicated as draft", async () => {
                  const res = await duplicateSow(sow.id);
                  if (res.ok && res.sowId) router.push(workPaths.sowId(res.sowId));
                  return res;
                })
              }
            >
              <CopyPlus size={12} /> Duplicate
            </button>
            <button
              type="button"
              disabled={pending || locked}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
              onClick={() => {
                if (!window.confirm(`Delete SOW “${sow.title}”?`)) return;
                run("Deleted", async () => {
                  const res = await deleteSow(sow.id);
                  if (res.ok) router.push(workPaths.sow);
                  return res;
                });
              }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
          <div
            className="min-h-[calc(100dvh-var(--os-header)-var(--os-bottom-nav)-8rem)] overflow-x-hidden"
            style={{ background: resolveSowTheme(sow.theme).background }}
          >
            <SowDocumentView sow={sow} mode="admin-preview" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <ContextBar
            context={context}
            bdRecords={bdRecords}
            pending={pending || locked}
            suggestionCount={suggestions.length}
            onSave={(patch) =>
              run("Context saved", async () => {
                const res = await saveSowAssistContext({
                  sowId: sow.id,
                  rawText: patch.rawText,
                  appendNote: patch.appendNote,
                  bdRecordId: patch.bdRecordId,
                  answers: patch.answers,
                });
                if (res.ok && res.context) {
                  setSow({ ...sow, assist_context: res.context });
                }
                return res;
              })
            }
            onGenerate={() =>
              run("Suggestions ready", async () => {
                const res = await proposeSowFromContext({ sowId: sow.id });
                if (res.ok && res.suggestions) {
                  setSow({
                    ...sow,
                    assist_context: {
                      ...context,
                      pending_suggestions: res.suggestions,
                    },
                  });
                  if (!res.usedAi) {
                    setMessage(
                      "Suggestions used heuristics (AI gateway not billed / unavailable)."
                    );
                  }
                }
                return res;
              })
            }
            onApplyAll={() =>
              run("Applied suggestions", async () => {
                const res = await applySowSuggestions({
                  sowId: sow.id,
                  fields: suggestions.map((s) => s.field),
                });
                if (res.ok) {
                  if (res.context) {
                    const ctx = res.context;
                    setSow((prev) => ({ ...prev, assist_context: ctx }));
                  }
                  await reloadSow();
                }
                return res;
              })
            }
          />
          <div className="grid grid-cols-1 min-w-0 overflow-x-hidden xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,280px)] flex-1 min-h-0 divide-y xl:divide-y-0 xl:divide-x divide-gray-200">
            <ScopeList
              sow={sow}
              services={services}
              packages={packages}
              selectedIds={selectedIds}
              activeId={activeId}
              mergeTitle={mergeTitle}
              mergePrice={mergePrice}
              pending={pending || locked}
              onSelectActive={setActiveId}
              onToggleSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  const secs = sow.sections.filter((s) => next.has(s.id));
                  if (secs.length >= 2) {
                    setMergeTitle(secs.map((s) => s.title).join(" + "));
                  }
                  return next;
                });
              }}
              onMergeTitle={setMergeTitle}
              onMergePrice={setMergePrice}
              onMerge={() =>
                run("Scopes merged", async () => {
                  const res = await mergeSowSections({
                    sowId: sow.id,
                    sectionIds: [...selectedIds],
                    title: mergeTitle,
                    groupPrice: Number(mergePrice) || 0,
                  });
                  if (res.ok) {
                    setSelectedIds(new Set());
                    if (res.sectionId) setActiveId(res.sectionId);
                    await reloadSow();
                  }
                  return res;
                })
              }
              onUnmerge={(sectionId) =>
                run("Unmerged", async () => {
                  const res = await unmergeSowSection({ sowId: sow.id, sectionId });
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
              onAddService={(serviceId) =>
                run("Service added", async () => {
                  const res = await addServiceToSow({
                    sowId: sow.id,
                    serviceId,
                  });
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
              onAddPackage={(packageId) =>
                run("Package added", async () => {
                  const res = await addPackageToSow({
                    sowId: sow.id,
                    packageId,
                  });
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
              onAddBlank={() =>
                run("Section added", async () => {
                  const res = await addCustomSection({
                    sowId: sow.id,
                    title: "Custom section",
                  });
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
            />
            <CopyPane
              sow={sow}
              section={activeSection}
              mode={activeId === "hero" ? "hero" : "section"}
              suggestions={suggestions}
              pending={pending || locked}
              onIntro={(v, save) => {
                setSow({ ...sow, intro_narrative: v });
                if (save) {
                  run("Intro saved", () =>
                    updateSowMeta({ sowId: sow.id, intro_narrative: v })
                  );
                }
              }}
              onConservative={(v, save) => {
                setSow({ ...sow, conservative_body: v });
                if (save) {
                  run("Saved", () =>
                    updateSowMeta({ sowId: sow.id, conservative_body: v })
                  );
                }
              }}
              onSectionTitle={(v, save) => {
                if (!activeSection) return;
                setSow({
                  ...sow,
                  sections: sow.sections.map((s) =>
                    s.id === activeSection.id ? { ...s, title: v } : s
                  ),
                });
                if (save) {
                  run("Saved", () =>
                    updateSection({ sectionId: activeSection.id, title: v })
                  );
                }
              }}
              onSectionDesc={(v, save) => {
                if (!activeSection) return;
                setSow({
                  ...sow,
                  sections: sow.sections.map((s) =>
                    s.id === activeSection.id
                      ? { ...s, service_description_snapshot: v, intro: null }
                      : s
                  ),
                });
                if (save) {
                  run("Saved", () =>
                    updateSection({
                      sectionId: activeSection.id,
                      service_description_snapshot: v,
                    })
                  );
                }
              }}
              onItemChange={(itemId, patch) => {
                setSow({
                  ...sow,
                  sections: sow.sections.map((s) => ({
                    ...s,
                    line_items: s.line_items.map((i) =>
                      i.id === itemId ? { ...i, ...patch } : i
                    ),
                  })),
                });
              }}
              onItemBlur={(itemId) => {
                const item = sow.sections
                  .flatMap((s) => s.line_items)
                  .find((i) => i.id === itemId);
                const section = sow.sections.find((s) =>
                  s.line_items.some((i) => i.id === itemId)
                );
                if (!item || !section) return;
                run("Saved", () =>
                  upsertLineItem({
                    id: item.id,
                    sowId: sow.id,
                    sectionId: section.id,
                    title: item.title,
                    description: item.description,
                    price: item.price,
                  })
                );
              }}
              onAddItem={() => {
                if (!activeSection) return;
                run("Item added", async () => {
                  const res = await upsertLineItem({
                    sowId: sow.id,
                    sectionId: activeSection.id,
                    title: "New deliverable",
                    is_manual: true,
                  });
                  if (res.ok) await reloadSow();
                  return res;
                });
              }}
              onDeleteItem={(id) =>
                run("Deleted", async () => {
                  const res = await deleteLineItem(id);
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
              onAccept={(field, text) =>
                run("Accepted", async () => {
                  const res = await applySowSuggestions({
                    sowId: sow.id,
                    fields: [field],
                    overrides: { [field]: text },
                  });
                  if (res.ok) {
                    if (res.context) {
                      const ctx = res.context;
                      setSow((prev) => ({ ...prev, assist_context: ctx }));
                    }
                    await reloadSow();
                  }
                  return res;
                })
              }
              onSkip={(field) =>
                run("Skipped", async () => {
                  const res = await skipSowSuggestions({
                    sowId: sow.id,
                    fields: [field],
                  });
                  if (res.ok && res.context) {
                    const ctx = res.context;
                    setSow((prev) => ({ ...prev, assist_context: ctx }));
                  }
                  return res;
                })
              }
              onRewrite={(field, current, mode) =>
                run("Rewritten", async () => {
                  const res = await rewriteSowField({
                    sowId: sow.id,
                    field,
                    current,
                    mode,
                  });
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
            />
            <DealPane
              sow={sow}
              suggestions={suggestions}
              pending={pending || locked}
              reuseSlides={reuseSlides}
              onTerms={(v, save) => {
                setSow({ ...sow, terms_text: v });
                if (save) {
                  run("Terms saved", () =>
                    updateSowMeta({ sowId: sow.id, terms_text: v })
                  );
                }
              }}
              onVat={(patch) => {
                const vat = { ...sow.vat, ...patch } as SowVat;
                setSow({ ...sow, vat });
                run("VAT saved", () => updateSowMeta({ sowId: sow.id, vat }));
              }}
              onTheme={(patch) => {
                const theme = { ...sow.theme, ...patch } as SowTheme;
                setSow({ ...sow, theme });
                run("Look saved", () => updateSowMeta({ sowId: sow.id, theme }));
              }}
              onReuse={(slide) =>
                run("Slide added", async () => {
                  const res = await reusePortfolioSlide({
                    sowId: sow.id,
                    title: slide.title,
                    image_url: slide.image_url || "",
                    caption: slide.caption,
                    link_url: slide.link_url,
                    source_url: slide.source_url,
                  });
                  if (res.ok && res.slide) addSlideToPreview(res.slide);
                  return res;
                })
              }
              onScrapeAdd={async (url) => {
                setMessage(null);
                const res = await fetch("/api/sow/portfolio-scrape", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url }),
                });
                const data = (await res.json()) as {
                  ok?: boolean;
                  error?: string;
                  title?: string;
                  imageCandidates?: string[];
                  canonicalUrl?: string;
                };
                if (!data.ok) {
                  setMessage(data.error || "Scrape failed");
                  return;
                }
                const img = data.imageCandidates?.[0];
                const added = await addPortfolioSlide({
                  sowId: sow.id,
                  title: data.title || "Project",
                  image_url: img,
                  candidate_images: data.imageCandidates,
                  source_url: data.canonicalUrl || url,
                  slide_kind: "scraped",
                });
                if (!added.ok) {
                  setMessage(added.error || "Could not add slide");
                  return;
                }
                if (added.slide) addSlideToPreview(added.slide);
                setMessage("Slide added");
              }}
              onUpload={async (file, title, url) => {
                try {
                  const image_url = await uploadSowScreenshot(sow.id, file);
                  const added = await addPortfolioSlide({
                    sowId: sow.id,
                    title: sanitizePortfolioTitle(title),
                    image_url,
                    link_url: url ? url : null,
                    slide_kind: "screenshot",
                  });
                  if (!added.ok) {
                    setMessage(added.error || "Could not add slide");
                    return;
                  }
                  if (added.slide) addSlideToPreview(added.slide);
                  setMessage("Slide added");
                } catch (e) {
                  setMessage(e instanceof Error ? e.message : "Upload failed");
                }
              }}
              onUpdateSlide={(id, patch) => {
                setSow((prev) => ({
                  ...prev,
                  portfolio_slides: prev.portfolio_slides.map((s) =>
                    s.id === id ? { ...s, ...patch } : s
                  ),
                }));
                run("Slide saved", () =>
                  updatePortfolioSlide({ sowId: sow.id, slideId: id, ...patch })
                );
              }}
              onFeatureSlide={(id) => {
                setSow((prev) => ({
                  ...prev,
                  portfolio_slides: withFeaturedSlide(prev.portfolio_slides, id),
                }));
                run("Featured", () =>
                  featurePortfolioSlide({ sowId: sow.id, slideId: id })
                );
              }}
              onDeleteSlide={(id) =>
                run("Removed", async () => {
                  const res = await deletePortfolioSlide(id);
                  if (res.ok) {
                    setSow((prev) => ({
                      ...prev,
                      portfolio_slides: prev.portfolio_slides.filter((s) => s.id !== id),
                    }));
                  }
                  return res;
                })
              }
              onAccept={(field, text) =>
                run("Accepted", async () => {
                  const res = await applySowSuggestions({
                    sowId: sow.id,
                    fields: [field],
                    overrides: { [field]: text },
                  });
                  if (res.ok) {
                    if (res.context) {
                      const ctx = res.context;
                      setSow((prev) => ({ ...prev, assist_context: ctx }));
                    }
                    await reloadSow();
                  }
                  return res;
                })
              }
              onSkip={(field) =>
                run("Skipped", async () => {
                  const res = await skipSowSuggestions({
                    sowId: sow.id,
                    fields: [field],
                  });
                  if (res.ok && res.context) {
                    const ctx = res.context;
                    setSow((prev) => ({ ...prev, assist_context: ctx }));
                  }
                  return res;
                })
              }
              onRewrite={(field, current, mode) =>
                run("Rewritten", async () => {
                  const res = await rewriteSowField({
                    sowId: sow.id,
                    field,
                    current,
                    mode,
                  });
                  if (res.ok) await reloadSow();
                  return res;
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
