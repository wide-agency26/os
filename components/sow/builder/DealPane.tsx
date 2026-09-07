"use client";

import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { SowDocument, SowPortfolioSlide, SowTheme, SowVat } from "@/lib/sow/types";
import type { SowSuggestion } from "@/lib/sow/assist";
import { suggestionFor } from "@/lib/sow/assist";
import { SuggestField } from "./SuggestField";
import {
  SOW_FONT_OPTIONS,
  SOW_ASSETS_BUCKET,
  computeSowSubtotal,
  formatSowMoney,
  renderVatLine,
  resolveSowVat,
} from "@/lib/sow/constants";
import {
  isUploadedFilename,
  normalizePortfolioUrl,
  orderedPortfolioSlides,
  portfolioCaseTitle,
  portfolioUrlRaw,
} from "@/lib/sow/portfolio";
import { loadProjectDealSnapshot } from "@/app/actions/projects-commercial";
import Link from "next/link";
import { formatEuro } from "@/lib/accounting/types";
import { createClient } from "@/utils/supabase/client";

type ReuseSlide = {
  id: string;
  sowId: string;
  sowTitle: string;
  title: string;
  caption: string | null;
  image_url: string | null;
  link_url: string | null;
  source_url: string | null;
};

export function DealPane({
  sow,
  suggestions,
  pending,
  reuseSlides,
  onTerms,
  onVat,
  onTheme,
  onReuse,
  onScrapeAdd,
  onUpload,
  onUpdateSlide,
  onFeatureSlide,
  onDeleteSlide,
  onAccept,
  onSkip,
  onRewrite,
}: {
  sow: SowDocument;
  suggestions: SowSuggestion[];
  pending: boolean;
  reuseSlides: ReuseSlide[];
  onTerms: (v: string, save?: boolean) => void;
  onVat: (patch: Partial<SowVat>) => void;
  onTheme: (patch: Partial<SowTheme>) => void;
  onReuse: (slide: ReuseSlide) => void;
  onScrapeAdd: (url: string) => Promise<void>;
  onUpload: (file: File, title: string, url?: string) => Promise<void>;
  onUpdateSlide: (id: string, patch: { title?: string; link_url?: string | null }) => void;
  onFeatureSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onAccept: (field: string, text: string) => void;
  onSkip: (field: string) => void;
  onRewrite: (field: string, current: string, mode: "rewrite" | "shorter" | "template") => void;
}) {
  const vat = resolveSowVat(sow.vat);
  const subtotal = computeSowSubtotal(sow);
  const vatAmount = vat.enabled ? subtotal * (vat.rate / 100) : 0;
  const total = subtotal + vatAmount;
  const [showLook, setShowLook] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [shotTitle, setShotTitle] = useState("");
  const [shotUrl, setShotUrl] = useState("");
  const [financeLine, setFinanceLine] = useState<string | null>(null);
  const [financeHref, setFinanceHref] = useState<string | null>(null);

  useEffect(() => {
    if (!sow.project_id) {
      setFinanceLine("Not in financials until this SOW is on a Lead project.");
      setFinanceHref(null);
      return;
    }
    void loadProjectDealSnapshot(sow.project_id).then((res) => {
      if (!res.ok || !res.snapshot) return;
      const s = res.snapshot;
      const amt = s.amount != null ? formatEuro(s.amount) : "€0";
      if (s.contractConfirmed) {
        setFinanceLine(`In Actual on the project · ${amt} net`);
        setFinanceHref("/app/accounting/actual");
      } else if (s.amount) {
        const extra =
          s.source === "sow_family_min" && s.versionCount > 1
            ? ` (lower of ${s.versionCount} versions)`
            : "";
        setFinanceLine(`In Identified · ${amt} net${extra}`);
        setFinanceHref("/app/accounting/identified");
      } else {
        setFinanceLine("Lead project created — add a price to land in Identified.");
        setFinanceHref(`/app/projects/${sow.project_id}`);
      }
    });
  }, [sow.project_id, sow.id, subtotal]);

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-y-auto">
      <div className="p-3 border-b border-gray-200 space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          Deal
        </p>
        <p className="text-lg font-semibold text-gray-950">
          {formatSowMoney(subtotal, sow.currency)}
          <span className="text-xs font-normal text-gray-500 ml-1">net</span>
        </p>
        {vat.enabled && subtotal > 0 && (
          <p className="text-[11px] text-gray-500">
            {renderVatLine(vat.wording, {
              subtotal,
              rate: vat.rate,
              vatAmount,
              total,
              currency: sow.currency,
            })}
          </p>
        )}
        {financeLine && (
          <p className="text-[11px] text-gray-600 pt-1">
            {sow.project_id ? (
              <Link href={`/app/projects/${sow.project_id}`} className="font-semibold text-blue-700">
                Open project
              </Link>
            ) : null}
            {sow.project_id ? " · " : ""}
            {financeHref ? (
              <Link href={financeHref} className="hover:underline">
                {financeLine}
              </Link>
            ) : (
              financeLine
            )}
          </p>
        )}
      </div>

      <div className="p-3 space-y-3 border-b border-gray-200">
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={vat.enabled}
            onChange={(e) => onVat({ enabled: e.target.checked })}
          />
          VAT {vat.enabled ? `${vat.rate}%` : "off"}
        </label>
        {vat.enabled && (
          <input
            type="number"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
            value={vat.rate}
            onChange={(e) => onVat({ rate: Number(e.target.value) || 0 })}
          />
        )}
      </div>

      <div className="p-3 border-b border-gray-200">
        <SuggestField
          label="Terms"
          field="terms_text"
          value={sow.terms_text}
          suggestion={suggestionFor(suggestions, "terms_text")}
          multiline
          pending={pending}
          onChange={(v) => onTerms(v)}
          onBlur={() => onTerms(sow.terms_text, true)}
          onAccept={onAccept}
          onSkip={onSkip}
          onRewrite={onRewrite}
        />
      </div>

      <div className="p-3 space-y-2 border-b border-gray-200">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          Portfolio · reuse first
        </p>
        <p className="text-[10px] text-gray-500">
          Feature one case — it becomes the large card at the top of the preview.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {reuseSlides.slice(0, 8).map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={pending || sow.portfolio_slides.length >= 6}
              className="text-left rounded-lg border border-gray-200 overflow-hidden hover:border-gray-400 disabled:opacity-40"
              onClick={() => onReuse(s)}
            >
              {s.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image_url} alt="" className="h-16 w-full object-cover" />
              ) : (
                <div className="h-16 bg-gray-100" />
              )}
              <p className="px-1.5 py-1 text-[10px] truncate text-gray-700">
                {portfolioCaseTitle(s)}
              </p>
            </button>
          ))}
        </div>
        {sow.portfolio_slides.length > 0 && (
          <ul className="space-y-2">
            {orderedPortfolioSlides(sow.portfolio_slides).map((s, idx) => (
              <PortfolioSlideRow
                key={s.id}
                slide={s}
                featured={idx === 0}
                pending={pending}
                onSave={(patch) => onUpdateSlide(s.id, patch)}
                onFeature={() => onFeatureSlide(s.id)}
                onDelete={() => onDeleteSlide(s.id)}
              />
            ))}
          </ul>
        )}
        <button
          type="button"
          className="text-[11px] font-medium text-blue-700"
          onClick={() => setShowOther((v) => !v)}
        >
          {showOther ? "Hide scrape / upload" : "Add other (scrape or upload)"}
        </button>
        {showOther && (
          <div className="space-y-2">
            <div className="flex gap-1">
              <input
                className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs"
                placeholder="wide-communication.com/project/…"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
              />
              <button
                type="button"
                className="rounded-md bg-gray-900 text-white px-2 text-[11px] font-semibold"
                onClick={() => void onScrapeAdd(scrapeUrl)}
              >
                Scrape
              </button>
            </div>
            <input
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs"
              placeholder="Case title"
              value={shotTitle}
              onChange={(e) => setShotTitle(e.target.value)}
            />
            <input
              className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs"
              placeholder="Project URL (optional)"
              value={shotUrl}
              onChange={(e) => setShotUrl(e.target.value)}
            />
            <label className="block text-[11px] text-gray-600">
              Upload screenshot
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-[11px]"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void onUpload(f, shotTitle.trim(), shotUrl.trim());
                    setShotTitle("");
                    setShotUrl("");
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        )}
      </div>

      <div className="p-3">
        <button
          type="button"
          className="text-[11px] font-medium text-gray-600"
          onClick={() => setShowLook((v) => !v)}
        >
          {showLook ? "Hide preview look" : "Preview look"}
        </button>
        {showLook && (
          <div className="mt-2 space-y-2">
            <select
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
              value={sow.theme.fontFamily}
              onChange={(e) =>
                onTheme({ fontFamily: e.target.value as SowTheme["fontFamily"] })
              }
            >
              {SOW_FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            {(
              [
                ["background", "Background"],
                ["text", "Text"],
                ["accent", "Accent"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-xs">
                {label}
                <input
                  type="color"
                  value={
                    sow.theme[key].startsWith("#") ? sow.theme[key] : "#000000"
                  }
                  onChange={(e) => onTheme({ [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioSlideRow({
  slide,
  featured,
  pending,
  onSave,
  onFeature,
  onDelete,
}: {
  slide: SowPortfolioSlide;
  featured: boolean;
  pending: boolean;
  onSave: (patch: { title?: string; link_url?: string | null }) => void;
  onFeature: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(
    isUploadedFilename(slide.title) ? "" : slide.title
  );
  const [url, setUrl] = useState(
    portfolioUrlRaw(slide).replace(/^https?:\/\//i, "")
  );

  useEffect(() => {
    setTitle(isUploadedFilename(slide.title) ? "" : slide.title);
    setUrl(portfolioUrlRaw(slide).replace(/^https?:\/\//i, ""));
  }, [slide.id, slide.title, slide.link_url, slide.source_url]);

  return (
    <li className="rounded-lg border border-gray-200 p-2 space-y-1.5">
      <div className="flex items-start gap-2">
        {slide.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image_url}
            alt=""
            className="h-11 w-16 shrink-0 rounded object-cover bg-gray-100"
          />
        ) : (
          <div className="h-11 w-16 shrink-0 rounded bg-gray-100" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <input
            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs"
            placeholder="Case title"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const next = title.trim() || "Untitled";
              const current = isUploadedFilename(slide.title)
                ? "Untitled"
                : slide.title.trim();
              if (next !== current) onSave({ title: next });
            }}
          />
          <input
            className="w-full rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600"
            placeholder="wide-communication.com/work/…"
            value={url}
            disabled={pending}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              const next = url.trim() ? normalizePortfolioUrl(url) : "";
              const current = portfolioUrlRaw(slide);
              const nextHref = next || "";
              const currentHref = current
                ? /^https?:\/\//i.test(current)
                  ? current
                  : `https://${current}`
                : "";
              if (nextHref !== currentHref) onSave({ link_url: next });
            }}
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {featured ? (
            <span className="text-[10px] font-semibold text-gray-900">Featured</span>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="text-[10px] font-medium text-blue-700 disabled:opacity-40"
              onClick={onFeature}
            >
              Feature
            </button>
          )}
          <button type="button" disabled={pending} onClick={onDelete}>
            <Trash2 size={11} className="text-gray-400 hover:text-red-600" />
          </button>
        </div>
      </div>
    </li>
  );
}

export async function uploadSowScreenshot(
  sowId: string,
  file: File
): Promise<string> {
  const supabase = createClient();
  const path = `${sowId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
  const { error } = await supabase.storage.from(SOW_ASSETS_BUCKET).upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(SOW_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
