"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/content/types";
import {
  loadClientBlogArticle,
  type ClientBlogArticleBody,
} from "@/app/actions/client-blog";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function daysInMonth(periodStart: string) {
  const [y, m] = periodStart.slice(0, 7).split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= last; d++) {
    cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export type ClientBlogArticle = {
  id: string;
  title: string;
  slug: string | null;
  language: string;
  meta_description: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  status: string;
};

function articleDate(a: { scheduled_for: string | null; published_at: string | null }): string | null {
  return a.scheduled_for || a.published_at?.slice(0, 10) || null;
}

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stripUnsafe(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value);
}

function markdownishToHtml(raw: string) {
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withMarks = escaped
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const blocks = withMarks
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<h[23]>/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .filter(Boolean);
  return blocks.join("") || `<p>${withMarks}</p>`;
}

function bodyToHtml(raw: string) {
  const cleaned = stripUnsafe(raw.trim());
  if (!cleaned) return "";
  return looksLikeHtml(cleaned) ? cleaned : markdownishToHtml(cleaned);
}

export function ClientBlogCalendar({
  projectId,
  periodStart,
  articles,
}: {
  projectId: string;
  periodStart: string;
  articles: ClientBlogArticle[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientBlogArticleBody | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lang, setLang] = useState("de");

  const cells = daysInMonth(periodStart);
  const byDate = useMemo(() => {
    const m: Record<string, ClientBlogArticle[]> = {};
    for (const a of articles) {
      const d = articleDate(a);
      if (!d) continue;
      (m[d] ||= []).push(a);
    }
    return m;
  }, [articles]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDetail(null);
    void loadClientBlogArticle(openId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.article) {
        setLoadError(res.error || "Could not load this article.");
        return;
      }
      setDetail(res.article);
      setLang(res.article.language || "de");
    });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  function go(delta: number) {
    const next = shiftMonth(periodStart, delta);
    router.push(`/app/client-blog?project=${projectId}&month=${next}`);
  }

  const articleButton = (a: ClientBlogArticle, dense: boolean) => (
    <button
      key={a.id}
      type="button"
      onClick={() => setOpenId(a.id)}
      className={`w-full text-left rounded-lg border border-border bg-surface ${
        dense ? "px-1.5 py-1 mb-1" : "px-3 py-2.5 min-h-11"
      }`}
    >
      <div
        className="mb-1.5 w-full overflow-hidden rounded bg-gradient-to-br from-gray-100 to-gray-200 border border-border flex flex-col items-center justify-center"
        style={{ aspectRatio: "16 / 9" }}
      >
        <span className="text-[8px] font-semibold uppercase tracking-wide text-text-muted">
          Cover
        </span>
        <span className="text-[8px] text-text-muted">16:9 · 1600×900</span>
      </div>
      <span
        className={`block text-text-primary leading-snug ${
          dense ? "text-[11px] line-clamp-2" : "text-[13px] font-medium"
        }`}
      >
        {a.title || "Untitled"}
      </span>
      <span className={`text-text-muted ${dense ? "text-[9px]" : "text-[11px] mt-1 inline-block"}`}>
        {a.status === "published" ? "Published" : "Scheduled"}
        {a.language ? ` · ${a.language.toUpperCase()}` : ""}
      </span>
    </button>
  );

  const primaryLang = detail?.language || "de";
  const enBlock = detail?.translations?.en;
  const hasEn = Boolean(enBlock?.body_md || enBlock?.title);
  const isEn = lang === "en" && hasEn;
  const viewTitle = isEn ? enBlock?.title || detail?.title : detail?.title;
  const viewBody = bodyToHtml(isEn ? enBlock?.body_md || "" : detail?.body_md || "");
  const liveUrl = isEn
    ? detail?.published_urls?.en || null
    : detail?.published_url || detail?.published_urls?.[primaryLang] || null;
  const when = detail ? articleDate(detail) : null;

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => go(-1)}
          className="p-2 rounded-md min-h-11 min-w-11 hover:bg-surface-raised"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[15px] font-medium text-text-primary">{monthLabel(periodStart)}</span>
        <button
          type="button"
          onClick={() => go(1)}
          className="p-2 rounded-md min-h-11 min-w-11 hover:bg-surface-raised"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="hidden md:grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-surface-raised px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted"
          >
            {d}
          </div>
        ))}
        {cells.map((iso, i) => (
          <div
            key={iso || `e-${i}`}
            className={`min-h-[96px] p-1.5 ${iso ? "bg-surface" : "bg-surface-raised"}`}
          >
            {iso ? (
              <>
                <div className="text-[11px] text-text-muted mb-1">{Number(iso.slice(8))}</div>
                {(byDate[iso] || []).map((a) => articleButton(a, true))}
              </>
            ) : null}
          </div>
        ))}
      </div>

      <div className="md:hidden space-y-2">
        {cells.filter((iso): iso is string => Boolean(iso)).map((iso) => {
          const day = byDate[iso] || [];
          if (!day.length) return null;
          return (
            <div key={iso} className="rounded-xl border border-border bg-surface p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                {new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div className="space-y-2">{day.map((a) => articleButton(a, false))}</div>
            </div>
          );
        })}
        {!articles.length ? (
          <p className="text-[13px] text-text-secondary py-8 text-center">
            No articles on the calendar this month.
          </p>
        ) : null}
      </div>

      {openId ? (
        <div
          className="fixed inset-0 z-[80] flex justify-end bg-black/20"
          onClick={() => setOpenId(null)}
        >
          <aside
            className="h-full w-full max-w-2xl bg-surface shadow-xl border-l border-border overflow-y-auto pb-[var(--os-bottom-nav)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface border-b border-border px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-text-muted">
                    {detail?.status === "published" ? "Published" : "Scheduled"}
                    {when ? ` · ${formatDay(when)}` : ""}
                  </p>
                  <h2 className="text-[18px] font-semibold text-text-primary mt-0.5 leading-snug">
                    {viewTitle || "Article"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="p-2 rounded-md min-h-11 min-w-11 hover:bg-surface-raised text-text-muted"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {hasEn ? (
                <div className="mt-3 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setLang(primaryLang)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                      !isEn ? "bg-accent text-white" : "bg-surface-raised text-text-secondary"
                    }`}
                  >
                    DE
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang("en")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${
                      isEn ? "bg-accent text-white" : "bg-surface-raised text-text-secondary"
                    }`}
                  >
                    EN
                  </button>
                </div>
              ) : null}
            </div>
            <div className="p-5">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                </div>
              ) : loadError ? (
                <p className="text-[13px] text-text-secondary">{loadError}</p>
              ) : viewBody ? (
                <article
                  className="client-blog-body text-[14px] text-text-secondary leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: viewBody }}
                />
              ) : (
                <p className="text-[13px] text-text-secondary">No copy for this language yet.</p>
              )}
              {liveUrl ? (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-6 text-[13px] font-medium text-accent hover:underline"
                >
                  View on the website
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
