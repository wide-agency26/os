"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import {
  createArticleDraft,
  expandBlogArticle,
  publishArticle,
  runArticleResearch,
  saveBlogArticle,
  setArticleStatus,
  translateBlogArticle,
} from "@/app/actions/blog-builder";
import type { BlogArticle, ResearchDossier, TranslationBlock } from "@/lib/blog/types";
import { workPaths } from "@/lib/work/paths";

function liveUrl(article: BlogArticle, lang: string) {
  return article.published_urls?.[lang] || (article.language === lang ? article.published_url : null) || null;
}

export function BlogEditor({ article }: { article: BlogArticle }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const langs = useMemo(() => {
    const set = new Set<string>([article.language || "de", ...Object.keys(article.translations || {})]);
    if (!set.has("en")) set.add("en");
    if (!set.has("de")) set.add("de");
    return [...set];
  }, [article.language, article.translations]);
  const [lang, setLang] = useState(article.language || langs[0]);
  const [title, setTitle] = useState(article.title);
  const [meta, setMeta] = useState(article.meta_description || "");
  const [body, setBody] = useState(article.body_md);
  const [transDrafts, setTransDrafts] = useState<Record<string, TranslationBlock>>(
    () => ({ ...(article.translations || {}) })
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const research = article.research as ResearchDossier;
  const uiSummary =
    Array.isArray(research?.ui_summary) && research.ui_summary.length
      ? research.ui_summary
      : research?.summary
        ? [research.summary]
        : [];

  const isPrimary = lang === (article.language || "de");
  const currentTitle = isPrimary ? title : transDrafts[lang]?.title || "";
  const currentBody = isPrimary ? body : transDrafts[lang]?.body_md || "";
  const currentMeta = isPrimary ? meta : transDrafts[lang]?.meta_description || "";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (!res.ok) setMsg(res.error || "Failed");
      else {
        if (okMsg) setMsg(okMsg);
        router.refresh();
      }
    });
  }

  function setCurrent(patch: { title?: string; body?: string; meta?: string }) {
    if (isPrimary) {
      if (patch.title != null) setTitle(patch.title);
      if (patch.body != null) setBody(patch.body);
      if (patch.meta != null) setMeta(patch.meta);
      return;
    }
    setTransDrafts((d) => ({
      ...d,
      [lang]: {
        title: patch.title ?? d[lang]?.title ?? "",
        body_md: patch.body ?? d[lang]?.body_md ?? "",
        meta_description: patch.meta ?? d[lang]?.meta_description ?? "",
      },
    }));
  }

  async function copyMarkdown() {
    const md = `# ${currentTitle}\n\n${currentBody}`.trim();
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={workPaths.projectBlog(article.project_id)} className="text-[12px] text-text-secondary">
            ← Blog queue
          </Link>
          <h1 className="text-xl font-semibold text-text-primary mt-1">{article.title || "Untitled"}</h1>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {langs.map((l) => {
              const url = liveUrl(article, l);
              return url ? (
                <a
                  key={l}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-emerald-50 text-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                >
                  {l} live
                </a>
              ) : (
                <span
                  key={l}
                  className="rounded-md bg-surface-raised text-text-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                >
                  {l} not live
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!uiSummary.length ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => runArticleResearch(article.id, article.project_id), "Research started")
              }
              className="rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold"
            >
              Research
            </button>
          ) : null}
          {!article.body_md ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => createArticleDraft(article.id, article.project_id), "Creating…")
              }
              className="rounded-md bg-accent text-white px-2.5 py-1.5 text-[12px] font-semibold"
            >
              Write draft
            </button>
          ) : null}
          {article.body_md ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => expandBlogArticle(article.id, article.project_id), "Expanding…")
              }
              className="rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold"
            >
              Expand
            </button>
          ) : null}
          {article.body_md ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => translateBlogArticle(article.id, article.project_id), "Translating…")
              }
              className="rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold"
            >
              Translate
            </button>
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => setArticleStatus(article.id, article.project_id, "ready"), "Ready to publish")
            }
            className="rounded-md border border-border px-2.5 py-1.5 text-[12px] font-semibold"
          >
            Mark ready
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => publishArticle(article.id, article.project_id), "Marked published")}
            className="rounded-md bg-accent text-white px-2.5 py-1.5 text-[12px] font-semibold"
          >
            I published this
          </button>
        </div>
      </div>

      {msg ? (
        <p className="text-[12px] rounded-md border border-border bg-surface-raised px-3 py-2">{msg}</p>
      ) : null}

      {uiSummary.length ? (
        <ul className="text-[13px] text-text-secondary list-disc pl-4 space-y-0.5">
          {uiSummary.slice(0, 4).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}

      <div className="inline-flex rounded-md border border-border p-0.5 bg-surface">
        {langs.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`px-3 py-1.5 rounded-md text-[12px] font-semibold uppercase ${
              lang === l ? "bg-accent text-white" : "text-text-secondary"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <input
          value={currentTitle}
          onChange={(e) => setCurrent({ title: e.target.value })}
          className="w-full rounded-md border border-border px-3 py-2 text-[16px] font-medium bg-surface"
          placeholder="Title"
        />
        <input
          value={currentMeta}
          onChange={(e) => setCurrent({ meta: e.target.value })}
          className="w-full rounded-md border border-border px-3 py-2 text-[13px] bg-surface"
          placeholder="Meta description"
        />
        <textarea
          value={currentBody}
          onChange={(e) => setCurrent({ body: e.target.value })}
          rows={26}
          className="w-full rounded-md border border-border px-3 py-2 text-[14px] leading-relaxed bg-surface"
          placeholder="Article markdown…"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                if (isPrimary) {
                  return saveBlogArticle(article.id, article.project_id, {
                    title,
                    meta_description: meta,
                    body_md: body,
                  });
                }
                return saveBlogArticle(article.id, article.project_id, {
                  translations: transDrafts,
                });
              }, "Saved")
            }
            className="rounded-md bg-accent text-white px-3 py-2 text-[13px] font-semibold"
          >
            Save {lang.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => void copyMarkdown()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] font-semibold"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied" : "Copy for CMS"}
          </button>
        </div>
      </div>

      {pending ? (
        <div className="fixed bottom-4 right-4 rounded-md bg-gray-900 text-white px-3 py-2 text-[12px] inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Working…
        </div>
      ) : null}
    </div>
  );
}
