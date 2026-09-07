"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Download, ExternalLink, Search } from "lucide-react";
import type { StoredPage } from "@/lib/seo/store";
import { Card, Chip, EmptyState, SectionLabel } from "./primitives";

type SortKey = "url" | "depth" | "status_code" | "word_count" | "internal_links_in" | "issues";

const PAGE_SIZE = 50;

function statusTone(status: number | null): "good" | "warn" | "bad" | "muted" {
  if (status === null) return "muted";
  if (status >= 200 && status < 300) return "good";
  if (status >= 300 && status < 400) return "warn";
  return "bad";
}

function toCsv(pages: StoredPage[]): string {
  const headers = [
    "url", "status_code", "depth", "indexable", "in_sitemap", "title",
    "title_length", "meta_description", "word_count", "internal_links_in",
    "internal_links_out", "canonical", "schema_types", "issue_codes",
  ];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = pages.map((p) =>
    [
      p.url, p.status_code, p.depth, p.indexable, p.in_sitemap, p.title,
      p.title_length, p.meta_description, p.word_count, p.internal_links_in,
      p.internal_links_out, p.canonical,
      (p.schema_types ?? []).join(" "),
      ((p as StoredPage & { issue_codes?: string[] }).issue_codes ?? []).join(" "),
    ]
      .map(escape)
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export function PagesTable({ pages, domain }: { pages: StoredPage[]; domain: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "errors" | "noindex" | "thin" | "orphan">("all");
  const [sortKey, setSortKey] = useState<SortKey>("depth");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = pages;

    if (filter === "errors") {
      list = list.filter((p) => p.status_code === null || p.status_code >= 400);
    } else if (filter === "noindex") {
      list = list.filter((p) => p.noindex || p.robots_blocked);
    } else if (filter === "thin") {
      list = list.filter((p) => p.indexable && (p.word_count ?? 0) < 250);
    } else if (filter === "orphan") {
      list = list.filter((p) => p.indexable && p.internal_links_in === 0 && p.depth > 0);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.url.toLowerCase().includes(q) || (p.title ?? "").toLowerCase().includes(q)
      );
    }

    const issueCount = (p: StoredPage) =>
      ((p as StoredPage & { issue_codes?: string[] }).issue_codes ?? []).length;

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "url") cmp = a.url.localeCompare(b.url);
      else if (sortKey === "issues") cmp = issueCount(a) - issueCount(b);
      else {
        const av = (a[sortKey] as number | null) ?? -1;
        const bv = (b[sortKey] as number | null) ?? -1;
        cmp = av - bv;
      }
      return ascending ? cmp : -cmp;
    });

    return sorted;
  }, [pages, filter, query, sortKey, ascending]);

  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAscending((v) => !v);
    else {
      setSortKey(key);
      setAscending(true);
    }
    setPage(0);
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${domain}-crawl-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!pages.length) return <EmptyState message="No pages were crawled in this run." />;

  const filters: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All pages", count: pages.length },
    {
      key: "errors",
      label: "Errors",
      count: pages.filter((p) => p.status_code === null || p.status_code >= 400).length,
    },
    {
      key: "noindex",
      label: "Blocked from search",
      count: pages.filter((p) => p.noindex || p.robots_blocked).length,
    },
    {
      key: "thin",
      label: "Thin content",
      count: pages.filter((p) => p.indexable && (p.word_count ?? 0) < 250).length,
    },
    {
      key: "orphan",
      label: "Orphans",
      count: pages.filter((p) => p.indexable && p.internal_links_in === 0 && p.depth > 0)
        .length,
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>Full crawl inventory</SectionLabel>
            <p className="mt-1 text-[12px] text-gray-600">
              Every page we reached, with the raw data behind the findings.
            </p>
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                setPage(0);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                filter === f.key
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {f.label} {f.count}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by URL or title"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-gray-400"
          />
        </div>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-[12px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <SortHeader label="URL" active={sortKey === "url"} onClick={() => sortBy("url")} align="left" />
              <SortHeader label="Status" active={sortKey === "status_code"} onClick={() => sortBy("status_code")} />
              <SortHeader label="Depth" active={sortKey === "depth"} onClick={() => sortBy("depth")} />
              <th className="px-3 py-2 text-left font-semibold">Title</th>
              <SortHeader label="Words" active={sortKey === "word_count"} onClick={() => sortBy("word_count")} />
              <SortHeader label="Links in" active={sortKey === "internal_links_in"} onClick={() => sortBy("internal_links_in")} />
              <SortHeader label="Issues" active={sortKey === "issues"} onClick={() => sortBy("issues")} />
              <th className="px-3 py-2 text-center font-semibold">In search</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((p) => {
              const issues = (p as StoredPage & { issue_codes?: string[] }).issue_codes ?? [];
              return (
                <tr key={p.id} className="hover:bg-gray-50/60">
                  <td className="max-w-[280px] px-3 py-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 max-w-full items-center gap-1 text-blue-700 hover:underline"
                    >
                      <span className="truncate">{p.path || p.url}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-50" />
                    </a>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Chip tone={statusTone(p.status_code)}>{p.status_code ?? "error"}</Chip>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-600">{p.depth}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-gray-700">
                    {p.title ?? <span className="text-red-600">missing</span>}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-600">
                    {p.word_count ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-gray-600">
                    {p.internal_links_in}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {issues.length ? (
                      <span className="font-semibold text-amber-700">{issues.length}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.indexable ? (
                      <span className="text-emerald-600">Yes</span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-[12px] text-gray-600">
          <span>
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)}{" "}
            of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1 font-medium disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1 font-medium disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
  align = "center",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: "left" | "center";
}) {
  return (
    <th className={`px-3 py-2 font-semibold ${align === "left" ? "text-left" : "text-center"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-gray-900 ${
          active ? "text-gray-900" : ""
        }`}
      >
        {label}
        <ArrowUpDown size={11} className="opacity-50" />
      </button>
    </th>
  );
}
