"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Merge,
  Plus,
  Printer,
  Trash2,
  Unlink,
} from "lucide-react";
import type { SowDocument, PmService, SowTheme, SowVat } from "@/lib/sow/types";
import { SowDocumentView } from "@/components/sow/SowDocumentView";
import {
  addCustomSection,
  addPortfolioSlide,
  addServiceToSow,
  deleteLineItem,
  deletePortfolioSlide,
  deleteSection,
  deleteSow,
  mergeLineItems,
  reorderLineItems,
  reorderSections,
  setSowStatus,
  unmergeCostGroup,
  updateCostGroup,
  updatePortfolioSlide,
  updateSection,
  updateSowMeta,
  upsertLineItem,
} from "@/app/actions/sow";
import { SOW_ASSETS_BUCKET, SOW_FONT_OPTIONS, SOW_STATUS_LABELS, computeSowSubtotal, renderVatLine, resolveSowTheme, resolveSowVat } from "@/lib/sow/constants";
import { createClient } from "@/utils/supabase/client";

export function SowBuilder({
  initial,
  services,
}: {
  initial: SowDocument;
  services: PmService[];
}) {
  const router = useRouter();
  const [sow, setSow] = useState(initial);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [mergeTitle, setMergeTitle] = useState("Grouped scope");
  const [mergePrice, setMergePrice] = useState("");
  const [addServiceId, setAddServiceId] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [scrapePreview, setScrapePreview] = useState<{
    title: string;
    imageCandidates: string[];
    canonicalUrl: string;
    picked?: string;
  } | null>(null);
  const [shotTitle, setShotTitle] = useState("");
  const [shotLink, setShotLink] = useState("");
  const [shotUploading, setShotUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    initial.public_slug ? `/s/${initial.public_slug}` : null
  );

  const usedServiceIds = useMemo(
    () => new Set(sow.sections.map((s) => s.service_id).filter(Boolean)),
    [sow.sections]
  );

  const availableServices = services.filter((s) => !usedServiceIds.has(s.id));

  function refresh() {
    router.refresh();
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMessage(res.error || "Something went wrong");
      else {
        setMessage(label);
        refresh();
      }
    });
  }

  useEffect(() => {
    setSow(initial);
    setShareUrl(initial.public_slug ? `/s/${initial.public_slug}` : null);
  }, [initial]);

  function patchTheme(partial: Partial<SowTheme>) {
    const next = { ...sow.theme, ...partial };
    setSow({ ...sow, theme: next });
    run("Theme saved", () =>
      updateSowMeta({ sowId: sow.id, theme: partial })
    );
  }

  function patchVat(partial: Partial<SowVat>) {
    const next = resolveSowVat({ ...sow.vat, ...partial });
    setSow({ ...sow, vat: next });
    run("VAT saved", () => updateSowMeta({ sowId: sow.id, vat: partial }));
  }

  const vatPreview = useMemo(() => {
    const vat = resolveSowVat(sow.vat);
    const subtotal = computeSowSubtotal(sow);
    if (!vat.enabled || subtotal <= 0) return null;
    const vatAmount = subtotal * (vat.rate / 100);
    return renderVatLine(vat.wording, {
      subtotal,
      rate: vat.rate,
      vatAmount,
      total: subtotal + vatAmount,
      currency: sow.currency,
    });
  }, [sow]);

  function absoluteShare(path: string) {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }

  async function uploadScreenshot(file: File) {
    if (!file) return;
    setShotUploading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${sow.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from(SOW_ASSETS_BUCKET)
        .upload(path, file, { contentType: file.type || "image/png", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(SOW_ASSETS_BUCKET).getPublicUrl(path);
      const res = await addPortfolioSlide({
        sowId: sow.id,
        title: shotTitle.trim() || file.name.replace(/\.[^.]+$/, ""),
        link_url: shotLink.trim() || null,
        source_url: shotLink.trim() || "",
        image_url: pub.publicUrl,
        candidate_images: [pub.publicUrl],
        slide_kind: "screenshot",
      });
      if (!res.ok) throw new Error(res.error || "Failed to add screenshot");
      setShotTitle("");
      setShotLink("");
      setMessage("Screenshot added");
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setShotUploading(false);
    }
  }

  async function scrapePortfolio() {
    setScrapeBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sow/portfolio-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: portfolioUrl }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.error || "Scrape failed");
        setScrapePreview(null);
        return;
      }
      setScrapePreview({
        title: data.title,
        imageCandidates: data.imageCandidates || [],
        canonicalUrl: data.canonicalUrl,
        picked: data.imageCandidates?.[0],
      });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScrapeBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            SOW Builder · {SOW_STATUS_LABELS[sow.status] || sow.status}
          </p>
          <input
            className="mt-0.5 w-full max-w-xl text-lg font-semibold text-gray-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
            value={sow.title}
            onChange={(e) => setSow({ ...sow, title: e.target.value })}
            onBlur={() =>
              run("Title saved", () =>
                updateSowMeta({ sowId: sow.id, title: sow.title })
              )
            }
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            onClick={() => window.open(`/app/bd/lms/${sow.id}/print`, "_blank")}
          >
            <Printer size={14} /> PDF / Print
          </button>
          {sow.status === "draft" ? (
            <button
              type="button"
              disabled={pending}
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
                      const url = absoluteShare(res.shareUrl);
                      try {
                        await navigator.clipboard.writeText(url);
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
              Publish & get share link
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
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
          {shareUrl && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
              onClick={async () => {
                const url = absoluteShare(shareUrl);
                try {
                  await navigator.clipboard.writeText(url);
                  setMessage(`Copied share link: ${url}`);
                } catch {
                  setMessage(url);
                }
              }}
              title={absoluteShare(shareUrl)}
            >
              <Copy size={14} /> Copy share URL
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            onClick={() => {
              if (!window.confirm(`Delete SOW “${sow.title}”? This cannot be undone.`)) return;
              run("Deleted", async () => {
                const res = await deleteSow(sow.id);
                if (res.ok) router.push("/app/bd/lms");
                return res;
              });
            }}
          >
            <Trash2 size={14} /> Delete SOW
          </button>
        </div>
      </div>

      {message && (
        <div className="px-4 py-2 text-xs bg-gray-50 border-b border-gray-200 text-gray-700">
          {message}
        </div>
      )}

      {tab === "preview" ? (
        <div
          className="min-h-[calc(100vh-120px)]"
          style={{ background: resolveSowTheme(sow.theme).background }}
        >
          <SowDocumentView sow={sow} mode="admin-preview" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-0 flex-1">
          <div className="px-4 py-6 space-y-8 min-w-0">
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Client-facing hero copy
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Everything here shows on the published SOW — edit what clients read.
                  </p>
                </div>
              </div>
              <textarea
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 min-h-[72px]"
                value={sow.intro_narrative || ""}
                placeholder="Intro narrative under the title"
                onChange={(e) => setSow({ ...sow, intro_narrative: e.target.value })}
                onBlur={() =>
                  run("Intro saved", () =>
                    updateSowMeta({
                      sowId: sow.id,
                      intro_narrative: sow.intro_narrative,
                    })
                  )
                }
              />

              <label className="flex flex-wrap items-center gap-3 text-sm text-gray-800">
                <span className="font-medium">Document date</span>
                <input
                  type="date"
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
                  value={sow.document_date?.slice(0, 10) || ""}
                  onChange={(e) =>
                    setSow({ ...sow, document_date: e.target.value })
                  }
                  onBlur={(e) =>
                    run("Date saved", () =>
                      updateSowMeta({
                        sowId: sow.id,
                        document_date: e.target.value,
                      })
                    )
                  }
                />
              </label>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Preview look
                </p>
                <label className="block space-y-1 text-xs font-medium text-gray-700">
                  Font
                  <select
                    className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm"
                    value={sow.theme.fontFamily}
                    onChange={(e) =>
                      patchTheme({
                        fontFamily: e.target.value as SowTheme["fontFamily"],
                      })
                    }
                  >
                    {SOW_FONT_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(
                    [
                      ["background", "Background"],
                      ["text", "Text"],
                      ["mutedText", "Muted text"],
                      ["accent", "Accent / cards"],
                      ["cardBg", "Card fill"],
                      ["border", "Borders"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block space-y-1 text-[11px] font-medium text-gray-600">
                      {label}
                      <input
                        type="color"
                        className="h-9 w-full rounded border border-gray-200 bg-white p-1"
                        value={
                          sow.theme[key].startsWith("#")
                            ? sow.theme[key].slice(0, 7)
                            : key === "background"
                              ? "#0A0A0A"
                              : key === "text" || key === "accent"
                                ? "#FFFFFF"
                                : "#888888"
                        }
                        onChange={(e) => patchTheme({ [key]: e.target.value })}
                      />
                      <input
                        className="w-full rounded border border-gray-200 px-1.5 py-1 text-[11px] font-mono"
                        value={sow.theme[key]}
                        onChange={(e) =>
                          setSow({
                            ...sow,
                            theme: { ...sow.theme, [key]: e.target.value },
                          })
                        }
                        onBlur={(e) => patchTheme({ [key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-900">
                    Conservative scope block
                  </p>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-amber-950">
                    <input
                      type="checkbox"
                      checked={sow.show_conservative_block}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSow({ ...sow, show_conservative_block: checked });
                        run(checked ? "Block shown" : "Block hidden", () =>
                          updateSowMeta({
                            sowId: sow.id,
                            show_conservative_block: checked,
                          })
                        );
                      }}
                    />
                    Show on SOW
                  </label>
                </div>
                <label className="flex items-center gap-3 text-sm text-amber-950">
                  <span className="font-medium shrink-0">Revision rounds</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="w-16 rounded-md border border-amber-300 bg-white px-2 py-1"
                    value={sow.revision_rounds}
                    onChange={(e) =>
                      setSow({ ...sow, revision_rounds: Number(e.target.value) || 2 })
                    }
                    onBlur={() =>
                      run("Revision rounds saved", () =>
                        updateSowMeta({
                          sowId: sow.id,
                          revision_rounds: sow.revision_rounds,
                        })
                      )
                    }
                  />
                </label>
                <input
                  className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
                  value={sow.conservative_eyebrow}
                  placeholder="Eyebrow label"
                  disabled={!sow.show_conservative_block}
                  onChange={(e) =>
                    setSow({ ...sow, conservative_eyebrow: e.target.value })
                  }
                  onBlur={() =>
                    run("Eyebrow saved", () =>
                      updateSowMeta({
                        sowId: sow.id,
                        conservative_eyebrow: sow.conservative_eyebrow,
                      })
                    )
                  }
                />
                <textarea
                  className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 min-h-[80px] disabled:opacity-50"
                  value={sow.conservative_body}
                  placeholder="Body copy — use {{revision_rounds}} to bind the number"
                  disabled={!sow.show_conservative_block}
                  onChange={(e) =>
                    setSow({ ...sow, conservative_body: e.target.value })
                  }
                  onBlur={() =>
                    run("Conservative body saved", () =>
                      updateSowMeta({
                        sowId: sow.id,
                        conservative_body: sow.conservative_body,
                      })
                    )
                  }
                />
                <p className="text-[11px] text-amber-800/80">
                  Tip: keep {"{{revision_rounds}}"} in the body so changing the number
                  above updates client copy automatically.
                </p>
              </div>
            </div>

            {sow.sections.map((section, sIdx) => (
              <div
                key={section.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 bg-gray-50">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {section.category} · {section.portrayal}
                    </p>
                    <input
                      className="w-full bg-transparent font-semibold text-gray-900 outline-none"
                      value={section.title}
                      onChange={(e) => {
                        const sections = sow.sections.map((s) =>
                          s.id === section.id ? { ...s, title: e.target.value } : s
                        );
                        setSow({ ...sow, sections });
                      }}
                      onBlur={(e) =>
                        run("Section title saved", () =>
                          updateSection({
                            sectionId: section.id,
                            title: e.target.value,
                          })
                        )
                      }
                    />
                    <label className="block pt-2 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Section description (preview intro)
                      </span>
                      <textarea
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 min-h-[72px] leading-relaxed"
                        placeholder="Short intro shown under the section title in the preview"
                        value={
                          section.service_description_snapshot ||
                          section.intro ||
                          ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          const sections = sow.sections.map((s) =>
                            s.id === section.id
                              ? {
                                  ...s,
                                  service_description_snapshot: value,
                                  intro: null,
                                }
                              : s
                          );
                          setSow({ ...sow, sections });
                        }}
                        onBlur={(e) =>
                          run("Section description saved", () =>
                            updateSection({
                              sectionId: section.id,
                              service_description_snapshot: e.target.value,
                              intro: null,
                            })
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500"
                      disabled={sIdx === 0}
                      onClick={() => {
                        const ids = sow.sections.map((s) => s.id);
                        [ids[sIdx - 1], ids[sIdx]] = [ids[sIdx], ids[sIdx - 1]];
                        run("Reordered", () =>
                          reorderSections({ sowId: sow.id, orderedIds: ids })
                        );
                      }}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-gray-200 text-gray-500"
                      disabled={sIdx === sow.sections.length - 1}
                      onClick={() => {
                        const ids = sow.sections.map((s) => s.id);
                        [ids[sIdx + 1], ids[sIdx]] = [ids[sIdx], ids[sIdx + 1]];
                        run("Reordered", () =>
                          reorderSections({ sowId: sow.id, orderedIds: ids })
                        );
                      }}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                      onClick={() =>
                        run("Section deleted", () => deleteSection(section.id))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {section.line_items.map((item, iIdx) => (
                    <div key={item.id} className="px-4 py-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selectedItems.has(item.id)}
                          onChange={(e) => {
                            const next = new Set(selectedItems);
                            if (e.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setSelectedItems(next);
                          }}
                          title="Select for merge"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              className="flex-1 min-w-[140px] font-medium text-sm text-gray-900 bg-transparent outline-none border-b border-transparent focus:border-blue-400"
                              value={item.title}
                              onChange={(e) => {
                                const sections = sow.sections.map((s) =>
                                  s.id !== section.id
                                    ? s
                                    : {
                                        ...s,
                                        line_items: s.line_items.map((li) =>
                                          li.id === item.id
                                            ? { ...li, title: e.target.value }
                                            : li
                                        ),
                                      }
                                );
                                setSow({ ...sow, sections });
                              }}
                              onBlur={(e) =>
                                run("Item saved", () =>
                                  upsertLineItem({
                                    id: item.id,
                                    sowId: sow.id,
                                    sectionId: section.id,
                                    title: e.target.value,
                                    description: item.description,
                                    price: item.price,
                                    quantity_label: item.quantity_label,
                                    cadence: item.cadence,
                                    is_recurring: item.is_recurring,
                                    requires_quantity: item.requires_quantity,
                                    uses_revision_rounds: item.uses_revision_rounds,
                                  })
                                )
                              }
                            />
                            {item.is_manual && (
                              <span className="text-[10px] uppercase font-bold text-gray-400">
                                Manual
                              </span>
                            )}
                            {item.cost_group_id && (
                              <span className="text-[10px] uppercase font-bold text-blue-600">
                                In group
                              </span>
                            )}
                            {item.is_gate_note && (
                              <span className="text-[10px] uppercase font-bold text-amber-700">
                                Gate note
                              </span>
                            )}
                          </div>
                          <textarea
                            className="w-full text-xs text-gray-600 bg-gray-50 rounded-md px-2 py-1.5 min-h-[48px] outline-none focus:ring-1 focus:ring-blue-300"
                            value={item.description || ""}
                            placeholder="Description"
                            onChange={(e) => {
                              const sections = sow.sections.map((s) =>
                                s.id !== section.id
                                  ? s
                                  : {
                                      ...s,
                                      line_items: s.line_items.map((li) =>
                                        li.id === item.id
                                          ? { ...li, description: e.target.value }
                                          : li
                                      ),
                                    }
                              );
                              setSow({ ...sow, sections });
                            }}
                            onBlur={(e) =>
                              run("Item saved", () =>
                                upsertLineItem({
                                  id: item.id,
                                  sowId: sow.id,
                                  sectionId: section.id,
                                  title: item.title,
                                  description: e.target.value,
                                  price: item.price,
                                  quantity_label: item.quantity_label,
                                  cadence: item.cadence,
                                  is_recurring: item.is_recurring,
                                  requires_quantity: item.requires_quantity,
                                  uses_revision_rounds: item.uses_revision_rounds,
                                })
                              )
                            }
                          />
                          <div className="flex flex-wrap gap-2 items-center">
                            {!item.cost_group_id && (
                              <label className="text-xs text-gray-500 flex items-center gap-1">
                                Price
                                <input
                                  type="number"
                                  className="w-24 rounded border border-gray-200 px-1.5 py-1"
                                  value={item.price ?? ""}
                                  onChange={(e) => {
                                    const price =
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value);
                                    const sections = sow.sections.map((s) =>
                                      s.id !== section.id
                                        ? s
                                        : {
                                            ...s,
                                            line_items: s.line_items.map((li) =>
                                              li.id === item.id ? { ...li, price } : li
                                            ),
                                          }
                                    );
                                    setSow({ ...sow, sections });
                                  }}
                                  onBlur={(e) =>
                                    run("Price saved", () =>
                                      upsertLineItem({
                                        id: item.id,
                                        sowId: sow.id,
                                        sectionId: section.id,
                                        title: item.title,
                                        description: item.description,
                                        price:
                                          e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                        quantity_label: item.quantity_label,
                                        cadence: item.cadence,
                                        is_recurring: item.is_recurring,
                                        requires_quantity: item.requires_quantity,
                                        uses_revision_rounds:
                                          item.uses_revision_rounds,
                                      })
                                    )
                                  }
                                />
                              </label>
                            )}
                            {item.requires_quantity && (
                              <label className="text-xs text-amber-800 flex items-center gap-1">
                                Quantity *
                                <input
                                  className="w-48 rounded border border-amber-300 px-1.5 py-1 bg-amber-50"
                                  placeholder="e.g. 8 posts/month"
                                  value={item.quantity_label || ""}
                                  onChange={(e) => {
                                    const sections = sow.sections.map((s) =>
                                      s.id !== section.id
                                        ? s
                                        : {
                                            ...s,
                                            line_items: s.line_items.map((li) =>
                                              li.id === item.id
                                                ? {
                                                    ...li,
                                                    quantity_label: e.target.value,
                                                  }
                                                : li
                                            ),
                                          }
                                    );
                                    setSow({ ...sow, sections });
                                  }}
                                  onBlur={(e) =>
                                    run("Quantity saved", () =>
                                      upsertLineItem({
                                        id: item.id,
                                        sowId: sow.id,
                                        sectionId: section.id,
                                        title: item.title,
                                        description: item.description,
                                        price: item.price,
                                        quantity_label: e.target.value,
                                        cadence: item.cadence,
                                        is_recurring: item.is_recurring,
                                        requires_quantity: true,
                                        uses_revision_rounds:
                                          item.uses_revision_rounds,
                                      })
                                    )
                                  }
                                />
                              </label>
                            )}
                            <label className="text-xs text-gray-600 inline-flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={item.is_recurring}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  const cadence = checked
                                    ? item.cadence || "monthly"
                                    : null;
                                  const sections = sow.sections.map((s) =>
                                    s.id !== section.id
                                      ? s
                                      : {
                                          ...s,
                                          line_items: s.line_items.map((li) =>
                                            li.id === item.id
                                              ? {
                                                  ...li,
                                                  is_recurring: checked,
                                                  cadence,
                                                }
                                              : li
                                          ),
                                        }
                                  );
                                  setSow({ ...sow, sections });
                                  run(checked ? "Marked monthly" : "One-off", () =>
                                    upsertLineItem({
                                      id: item.id,
                                      sowId: sow.id,
                                      sectionId: section.id,
                                      title: item.title,
                                      description: item.description,
                                      price: item.price,
                                      quantity_label: item.quantity_label,
                                      cadence,
                                      is_recurring: checked,
                                      requires_quantity: item.requires_quantity,
                                      uses_revision_rounds: item.uses_revision_rounds,
                                    })
                                  );
                                }}
                              />
                              Monthly badge
                            </label>
                            {item.is_recurring && (
                              <input
                                className="w-28 rounded border border-gray-200 px-1.5 py-1 text-xs"
                                value={item.cadence || "monthly"}
                                placeholder="monthly"
                                onChange={(e) => {
                                  const sections = sow.sections.map((s) =>
                                    s.id !== section.id
                                      ? s
                                      : {
                                          ...s,
                                          line_items: s.line_items.map((li) =>
                                            li.id === item.id
                                              ? { ...li, cadence: e.target.value }
                                              : li
                                          ),
                                        }
                                  );
                                  setSow({ ...sow, sections });
                                }}
                                onBlur={(e) =>
                                  run("Cadence saved", () =>
                                    upsertLineItem({
                                      id: item.id,
                                      sowId: sow.id,
                                      sectionId: section.id,
                                      title: item.title,
                                      description: item.description,
                                      price: item.price,
                                      quantity_label: item.quantity_label,
                                      cadence: e.target.value,
                                      is_recurring: true,
                                      requires_quantity: item.requires_quantity,
                                      uses_revision_rounds: item.uses_revision_rounds,
                                    })
                                  )
                                }
                              />
                            )}
                            {item.uses_revision_rounds && (
                              <span className="text-[11px] text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                                Uses SOW revision rounds ({sow.revision_rounds})
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-100 text-gray-400"
                            disabled={iIdx === 0}
                            onClick={() => {
                              const ids = section.line_items.map((i) => i.id);
                              [ids[iIdx - 1], ids[iIdx]] = [ids[iIdx], ids[iIdx - 1]];
                              run("Reordered", () =>
                                reorderLineItems({
                                  sowId: sow.id,
                                  sectionId: section.id,
                                  orderedIds: ids,
                                })
                              );
                            }}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-gray-100 text-gray-400"
                            disabled={iIdx === section.line_items.length - 1}
                            onClick={() => {
                              const ids = section.line_items.map((i) => i.id);
                              [ids[iIdx + 1], ids[iIdx]] = [ids[iIdx], ids[iIdx + 1]];
                              run("Reordered", () =>
                                reorderLineItems({
                                  sowId: sow.id,
                                  sectionId: section.id,
                                  orderedIds: ids,
                                })
                              );
                            }}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-red-50 text-red-400"
                            onClick={() =>
                              run("Item deleted", () => deleteLineItem(item.id))
                            }
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
                    onClick={() =>
                      run("Line item added", () =>
                        upsertLineItem({
                          sowId: sow.id,
                          sectionId: section.id,
                          title: "Custom deliverable",
                          is_manual: true,
                        })
                      )
                    }
                  >
                    <Plus size={14} /> Add manual line item
                  </button>
                </div>
              </div>
            ))}

            {sow.cost_groups.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Cost groups</h3>
                {sow.cost_groups.map((g) => (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-900 bg-gray-950 text-white px-4 py-3"
                  >
                    <input
                      className="bg-transparent border-b border-white/20 font-medium outline-none flex-1 min-w-[140px]"
                      value={g.title}
                      onChange={(e) =>
                        setSow({
                          ...sow,
                          cost_groups: sow.cost_groups.map((cg) =>
                            cg.id === g.id ? { ...cg, title: e.target.value } : cg
                          ),
                        })
                      }
                      onBlur={(e) =>
                        run("Group saved", () =>
                          updateCostGroup({
                            sowId: sow.id,
                            costGroupId: g.id,
                            title: e.target.value,
                          })
                        )
                      }
                    />
                    <input
                      type="number"
                      className="w-28 rounded bg-white/10 border border-white/20 px-2 py-1 text-sm"
                      value={g.price}
                      onChange={(e) =>
                        setSow({
                          ...sow,
                          cost_groups: sow.cost_groups.map((cg) =>
                            cg.id === g.id
                              ? { ...cg, price: Number(e.target.value) || 0 }
                              : cg
                          ),
                        })
                      }
                      onBlur={(e) =>
                        run("Group price saved", () =>
                          updateCostGroup({
                            sowId: sow.id,
                            costGroupId: g.id,
                            price: Number(e.target.value) || 0,
                          })
                        )
                      }
                    />
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"
                      onClick={() =>
                        run("Unmerged", () =>
                          unmergeCostGroup({ sowId: sow.id, costGroupId: g.id })
                        )
                      }
                    >
                      <Unlink size={12} /> Unmerge
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Portfolio slides (3–6)
                </h3>
                <a
                  href="https://www.wide-communication.com/projects"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 inline-flex items-center gap-1"
                >
                  Browse work <ExternalLink size={12} />
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Pull from wide-communication.com
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="flex-1 min-w-[220px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="https://www.wide-communication.com/project/…"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={scrapeBusy}
                    onClick={() => void scrapePortfolio()}
                    className="rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
                  >
                    {scrapeBusy ? "Pulling…" : "Pull title & images"}
                  </button>
                </div>
              </div>

              {scrapePreview && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-3 bg-gray-50">
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm font-medium"
                    value={scrapePreview.title}
                    onChange={(e) =>
                      setScrapePreview({ ...scrapePreview, title: e.target.value })
                    }
                  />
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {scrapePreview.imageCandidates.map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() =>
                          setScrapePreview({ ...scrapePreview, picked: src })
                        }
                        className={`aspect-square overflow-hidden rounded-md border-2 ${
                          scrapePreview.picked === src
                            ? "border-blue-600"
                            : "border-transparent"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-2"
                    onClick={() =>
                      run("Slide added", async () => {
                        const res = await addPortfolioSlide({
                          sowId: sow.id,
                          source_url: scrapePreview.canonicalUrl,
                          link_url: scrapePreview.canonicalUrl,
                          title: scrapePreview.title,
                          image_url: scrapePreview.picked ?? null,
                          candidate_images: scrapePreview.imageCandidates,
                          slide_kind: "scraped",
                        });
                        if (res.ok) {
                          setScrapePreview(null);
                          setPortfolioUrl("");
                        }
                        return res;
                      })
                    }
                  >
                    Add slide
                  </button>
                </div>
              )}

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Or upload a screenshot
                </p>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Title"
                  value={shotTitle}
                  onChange={(e) => setShotTitle(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Link to live page (optional)"
                  value={shotLink}
                  onChange={(e) => setShotLink(e.target.value)}
                />
                <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50">
                  <Plus size={14} />
                  {shotUploading ? "Uploading…" : "Choose image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={shotUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadScreenshot(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sow.portfolio_slides.map((slide) => (
                  <div
                    key={slide.id}
                    className="rounded-lg border border-gray-200 overflow-hidden bg-white"
                  >
                    <div className="aspect-[4/3] bg-gray-100">
                      {slide.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slide.image_url}
                          alt={slide.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Preview title
                        </span>
                        <input
                          className="w-full text-sm font-medium border border-gray-200 rounded px-2 py-1.5"
                          value={slide.title}
                          onChange={(e) =>
                            setSow({
                              ...sow,
                              portfolio_slides: sow.portfolio_slides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, title: e.target.value }
                                  : s
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Preview subtitle / caption
                        </span>
                        <input
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                          placeholder='e.g. "Brand Design" or "View the project"'
                          value={slide.caption || ""}
                          onChange={(e) =>
                            setSow({
                              ...sow,
                              portfolio_slides: sow.portfolio_slides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, caption: e.target.value }
                                  : s
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          Link URL
                        </span>
                        <input
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                          placeholder="https://…"
                          value={slide.link_url || slide.source_url || ""}
                          onChange={(e) =>
                            setSow({
                              ...sow,
                              portfolio_slides: sow.portfolio_slides.map((s) =>
                                s.id === slide.id
                                  ? { ...s, link_url: e.target.value }
                                  : s
                              ),
                            })
                          }
                        />
                      </label>
                      {slide.candidate_images.length > 1 && (
                        <label className="block space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                            Thumbnail
                          </span>
                          <select
                            className="w-full text-xs border border-gray-200 rounded px-1 py-1.5"
                            value={slide.image_url || ""}
                            onChange={(e) => {
                              const image_url = e.target.value;
                              setSow({
                                ...sow,
                                portfolio_slides: sow.portfolio_slides.map((s) =>
                                  s.id === slide.id ? { ...s, image_url } : s
                                ),
                              });
                            }}
                          >
                            {slide.candidate_images.map((src, idx) => (
                              <option key={src} value={src}>
                                Image {idx + 1}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">
                          {slide.slide_kind}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                            onClick={() =>
                              run("Slide saved", () =>
                                updatePortfolioSlide({
                                  sowId: sow.id,
                                  slideId: slide.id,
                                  title: slide.title,
                                  caption: slide.caption,
                                  link_url: slide.link_url,
                                  image_url: slide.image_url,
                                })
                              )
                            }
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() =>
                              run("Slide deleted", () =>
                                deletePortfolioSlide(slide.id)
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-900">VAT & total</h3>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={sow.vat.enabled}
                    onChange={(e) =>
                      patchVat({ enabled: e.target.checked })
                    }
                  />
                  Show on preview
                </label>
              </div>
              <p className="text-xs text-gray-500">
                Net total is calculated from line-item prices and merged cost
                groups. Placeholders:{" "}
                <code className="text-[11px]">{"{{subtotal}}"}</code>,{" "}
                <code className="text-[11px]">{"{{rate}}"}</code>,{" "}
                <code className="text-[11px]">{"{{vat}}"}</code>,{" "}
                <code className="text-[11px]">{"{{total}}"}</code>
              </p>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                VAT rate (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  value={sow.vat.rate}
                  disabled={!sow.vat.enabled}
                  onChange={(e) =>
                    setSow({
                      ...sow,
                      vat: {
                        ...sow.vat,
                        rate: Number(e.target.value) || 0,
                      },
                    })
                  }
                  onBlur={(e) =>
                    patchVat({ rate: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="block space-y-1 text-xs font-medium text-gray-700">
                Wording
                <input
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-mono"
                  value={sow.vat.wording}
                  disabled={!sow.vat.enabled}
                  onChange={(e) =>
                    setSow({
                      ...sow,
                      vat: { ...sow.vat, wording: e.target.value },
                    })
                  }
                  onBlur={(e) => patchVat({ wording: e.target.value })}
                />
              </label>
              {vatPreview ? (
                <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 tabular-nums">
                  Preview: {vatPreview}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Add prices to line items or cost groups to preview the total
                  line.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Terms</h3>
              <p className="text-xs text-gray-500">
                Use {"{{revision_rounds}}"} to bind revision language to the SOW
                default.
              </p>
              <textarea
                className="w-full min-h-[180px] rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                value={sow.terms_text}
                onChange={(e) => setSow({ ...sow, terms_text: e.target.value })}
                onBlur={() =>
                  run("Terms saved", () =>
                    updateSowMeta({ sowId: sow.id, terms_text: sow.terms_text })
                  )
                }
              />
            </div>
          </div>

          <aside className="border-l border-gray-200 bg-gray-50 p-4 space-y-6 lg:sticky lg:top-[57px] lg:self-start lg:max-h-[calc(100vh-57px)] lg:overflow-y-auto">
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Add service
              </h3>
              <select
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                value={addServiceId}
                onChange={(e) => setAddServiceId(e.target.value)}
              >
                <option value="">Select catalog service…</option>
                {availableServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!addServiceId}
                className="w-full rounded-lg bg-gray-900 text-white text-xs font-semibold py-2 disabled:opacity-40"
                onClick={() =>
                  run("Service added", async () => {
                    const res = await addServiceToSow({
                      sowId: sow.id,
                      serviceId: addServiceId,
                    });
                    if (res.ok) setAddServiceId("");
                    return res;
                  })
                }
              >
                Add from catalog
              </button>
              <button
                type="button"
                className="w-full rounded-lg border border-gray-300 text-xs font-medium py-2 hover:bg-white"
                onClick={() =>
                  run("Custom section added", () =>
                    addCustomSection({
                      sowId: sow.id,
                      title: "Custom section",
                    })
                  )
                }
              >
                Add blank section
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Merge line items
              </h3>
              <p className="text-[11px] text-gray-500">
                Select 2+ items with checkboxes, set one group price. Original
                prices are preserved for unmerge.
              </p>
              <input
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={mergeTitle}
                onChange={(e) => setMergeTitle(e.target.value)}
                placeholder="Group title"
              />
              <input
                type="number"
                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                value={mergePrice}
                onChange={(e) => setMergePrice(e.target.value)}
                placeholder="Group price"
              />
              <button
                type="button"
                disabled={selectedItems.size < 2}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold py-2 disabled:opacity-40"
                onClick={() =>
                  run("Merged", async () => {
                    const res = await mergeLineItems({
                      sowId: sow.id,
                      itemIds: [...selectedItems],
                      groupTitle: mergeTitle,
                      groupPrice: Number(mergePrice) || 0,
                    });
                    if (res.ok) setSelectedItems(new Set());
                    return res;
                  })
                }
              >
                <Merge size={14} /> Merge selected ({selectedItems.size})
              </button>
            </div>

            <div className="text-[11px] text-gray-500 space-y-1">
              <p>
                Company:{" "}
                <span className="text-gray-800">
                  {sow.company?.company || sow.company?.name || "—"}
                </span>
              </p>
              {sow.package?.name && (
                <p>
                  Package:{" "}
                  <span className="text-gray-800">{sow.package.name}</span>
                </p>
              )}
              {shareUrl ? (
                <p className="break-all">
                  <Link2 size={11} className="inline mr-1" />
                  Public:{" "}
                  <a
                    className="text-blue-600"
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shareUrl}
                  </a>
                </p>
              ) : (
                <p className="text-amber-700">
                  Publish to generate a public share URL (no login required).
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
