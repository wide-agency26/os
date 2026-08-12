"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { saveBdSlideDeck } from "@/app/actions/bd";
import { normalizeSlides, type BdSlide } from "@/lib/bd/slides";

export function SlideBuilder({
  deckId,
  initialTitle,
  initialStatus,
  initialSlides,
  publicSlug,
  bdRecordId,
}: {
  deckId: string;
  initialTitle: string;
  initialStatus: string;
  initialSlides: unknown;
  publicSlug: string | null;
  bdRecordId: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [slides, setSlides] = useState<BdSlide[]>(
    normalizeSlides(initialSlides)
  );
  const [status, setStatus] = useState(initialStatus);
  const [slug, setSlug] = useState(publicSlug);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [scrapingIdx, setScrapingIdx] = useState<number | null>(null);

  function updateSlide(idx: number, patch: Partial<BdSlide>) {
    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }

  function move(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= slides.length) return;
    setSlides((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy.map((s, i) => ({ ...s, sort_order: i }));
    });
  }

  function remove(idx: number) {
    setSlides((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i }))
    );
  }

  function addCustom() {
    setSlides((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        kind: "custom",
        title: "New slide",
        body: "",
        bullets: [],
        service_id: null,
        portfolio: null,
        sort_order: prev.length,
      },
    ]);
  }

  async function scrapePortfolio(idx: number) {
    if (!portfolioUrl.trim()) return;
    setScrapingIdx(idx);
    setMessage(null);
    try {
      const res = await fetch("/api/sow/portfolio-scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: portfolioUrl.trim() }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        title?: string;
        imageCandidates?: string[];
        canonicalUrl?: string;
      };
      if (!json.ok) {
        setMessage(json.error || "Scrape failed");
        return;
      }
      const candidates = json.imageCandidates || [];
      updateSlide(idx, {
        title: json.title || slides[idx].title,
        body: slides[idx].body,
        portfolio: {
          source_url: json.canonicalUrl || portfolioUrl.trim(),
          link_url: json.canonicalUrl || portfolioUrl.trim(),
          title: json.title || "",
          caption: null,
          image_url: candidates[0] || null,
          candidate_images: candidates,
        },
      });
      setMessage("Portfolio slide updated from project URL.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScrapingIdx(null);
    }
  }

  function save(publish = false) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveBdSlideDeck({
        id: deckId,
        title,
        slides,
        publish,
      });
      if (!res.ok) {
        setMessage(res.error || "Save failed");
        return;
      }
      if (publish) {
        setStatus("published");
        if (res.publicSlug) setSlug(res.publicSlug);
      }
      setMessage(publish ? "Published and linked on BD proposal." : "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Proposal Builder · Slides
          </p>
          <input
            className="mt-1 text-2xl font-semibold text-gray-950 bg-transparent border-b border-transparent focus:border-gray-300 outline-none w-full max-w-xl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Status: {status}
            {bdRecordId && (
              <>
                {" · "}
                <Link className="text-blue-700" href={`/app/bd/${bdRecordId}`}>
                  BD record
                </Link>
              </>
            )}
            {slug && (
              <>
                {" · "}
                <a
                  className="text-blue-700"
                  href={`/p/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /p/{slug}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/bd/proposal"
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold"
          >
            Hub
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      {message && (
        <p className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <div className="space-y-4">
        {slides.map((slide, idx) => (
          <section
            key={slide.id}
            className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {slide.kind} · #{idx + 1}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="p-1.5 rounded border border-gray-200"
                  onClick={() => move(idx, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded border border-gray-200"
                  onClick={() => move(idx, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded border border-gray-200 text-red-600"
                  onClick={() => remove(idx)}
                  aria-label="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
              value={slide.title}
              onChange={(e) => updateSlide(idx, { title: e.target.value })}
            />
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
              value={slide.body}
              onChange={(e) => updateSlide(idx, { body: e.target.value })}
            />
            <label className="block space-y-1 text-xs font-medium text-gray-700">
              Bullets (one per line)
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[64px] font-mono"
                value={slide.bullets.join("\n")}
                onChange={(e) =>
                  updateSlide(idx, {
                    bullets: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            {slide.kind === "portfolio" && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
                <p className="text-xs font-medium text-gray-700">
                  Portfolio scrape (wide-communication.com/project/…)
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="flex-1 min-w-[200px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://www.wide-communication.com/project/…"
                  />
                  <button
                    type="button"
                    disabled={scrapingIdx === idx}
                    onClick={() => void scrapePortfolio(idx)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {scrapingIdx === idx ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Pull case study
                  </button>
                </div>
                {slide.portfolio?.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.portfolio.image_url}
                    alt=""
                    className="max-h-40 rounded-lg border border-gray-200 object-cover"
                  />
                )}
                {slide.portfolio?.candidate_images &&
                  slide.portfolio.candidate_images.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {slide.portfolio.candidate_images.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() =>
                            updateSlide(idx, {
                              portfolio: {
                                ...slide.portfolio!,
                                image_url: url,
                              },
                            })
                          }
                          className={`rounded border p-0.5 ${
                            slide.portfolio?.image_url === url
                              ? "border-gray-900"
                              : "border-gray-200"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="h-12 w-16 object-cover rounded"
                          />
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </section>
        ))}
      </div>

      <button
        type="button"
        onClick={addCustom}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700"
      >
        <Plus size={14} /> Add slide
      </button>
    </div>
  );
}
