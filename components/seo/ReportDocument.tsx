import type { SeoRunBundle } from "@/lib/seo/load-run";
import { scoreBand } from "@/lib/seo/constants";
import { TONE_HEX, scoreTone } from "./primitives";

/**
 * Client-ready share view.
 *
 * Deliberately linear rather than tabbed: the reader scrolls once, top to
 * bottom, and "Print → Save as PDF" produces a clean deliverable. No admin
 * controls, no raw crawl table, no interactive filters.
 */

const PILLARS: { key: "technical" | "content" | "performance" | "search_presence"; label: string }[] = [
  { key: "technical", label: "Technical" },
  { key: "content", label: "Content" },
  { key: "performance", label: "Performance" },
  { key: "search_presence", label: "Search presence" },
];

const SEVERITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "#fef2f2", text: "#991b1b", label: "Critical" },
  high: { bg: "#fef2f2", text: "#b91c1c", label: "High priority" },
  medium: { bg: "#fffbeb", text: "#b45309", label: "Medium" },
  low: { bg: "#f9fafb", text: "#4b5563", label: "Low" },
  info: { bg: "#eff6ff", text: "#1d4ed8", label: "Opportunity" },
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 break-inside-avoid">
      <div className="border-b border-gray-200 pb-2">
        <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ReportDocument({
  bundle,
  autoPrint = false,
}: {
  bundle: SeoRunBundle;
  autoPrint?: boolean;
}) {
  const { run, site, issues, queries } = bundle;
  const band = scoreBand(run.score);
  const tone = scoreTone(run.score);

  const priorityIssues = issues
    .filter((i) => i.severity !== "info")
    .slice(0, 12);
  const opportunities = issues.filter((i) => i.severity === "info");

  const clusters = new Map<string, typeof queries>();
  for (const q of queries) {
    if (!q.cluster) continue;
    const bucket = clusters.get(q.cluster);
    if (bucket) bucket.push(q);
    else clusters.set(q.cluster, [q]);
  }
  const gapClusters = [...clusters.entries()]
    .filter(([, items]) => items[0]?.coverage === "gap")
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  const roadmap = run.summary.roadmap ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12 print:max-w-none print:px-0 print:py-0">
      {autoPrint ? (
        <script
          dangerouslySetInnerHTML={{
            __html: "window.addEventListener('load', () => window.print());",
          }}
        />
      ) : null}

      <style>{`
        @media print {
          @page { margin: 18mm 14mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          section { break-inside: avoid; }
          a { text-decoration: none; color: inherit; }
        }
      `}</style>

      <header className="space-y-5 border-b border-gray-200 pb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400">
          SEO Audit
        </div>
        <div>
          <h1 className="text-[30px] font-semibold leading-tight text-gray-900">
            {site.domain}
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">
            Prepared{" "}
            {new Date(run.finished_at ?? run.created_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {run.stats.pages_crawled
              ? ` · ${run.stats.pages_crawled.toLocaleString()} pages reviewed`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-8">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Overall health
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className="text-[44px] font-semibold leading-none tabular-nums"
                style={{ color: TONE_HEX[tone] }}
              >
                {run.score ?? "—"}
              </span>
              <span className="text-[15px] text-gray-400">/ 100</span>
            </div>
            <div className="mt-1 text-[13px] font-medium" style={{ color: TONE_HEX[tone] }}>
              {band.label}
            </div>
          </div>

          {run.scores ? (
            <div className="grid flex-1 grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
              {PILLARS.map((p) => {
                const unavailable = run.scores?.unavailable?.includes(p.key);
                const value = run.scores?.[p.key];
                return (
                  <div key={p.key}>
                    <div className="text-[11px] text-gray-500">{p.label}</div>
                    <div className="text-[18px] font-semibold tabular-nums text-gray-900">
                      {unavailable ? "—" : (value ?? "—")}
                    </div>
                    {unavailable ? (
                      <div className="text-[10px] text-gray-400">not measured</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </header>

      {run.summary.executive ? (
        <Section title="Summary">
          {run.summary.headline ? (
            <p className="text-[15px] font-medium leading-relaxed text-gray-900">
              {run.summary.headline}
            </p>
          ) : null}
          <p className="text-[14px] leading-relaxed text-gray-700">
            {run.summary.executive}
          </p>

          {run.summary.strengths?.length ? (
            <div className="pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Working well
              </div>
              <ul className="mt-1.5 space-y-1">
                {run.summary.strengths.map((s) => (
                  <li key={s} className="text-[13px] leading-relaxed text-gray-700">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {run.summary.risks?.length ? (
            <div className="pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Needs attention
              </div>
              <ul className="mt-1.5 space-y-1">
                {run.summary.risks.map((r) => (
                  <li key={r} className="text-[13px] leading-relaxed text-gray-700">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {priorityIssues.length ? (
        <Section
          title="What to fix first"
          subtitle="Ordered by how much difference each change makes against how much work it takes."
        >
          <ol className="space-y-4">
            {priorityIssues.map((issue, index) => {
              const style = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.low;
              return (
                <li key={issue.id} className="break-inside-avoid">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 shrink-0 text-[13px] font-semibold tabular-nums text-gray-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[14px] font-semibold text-gray-900">
                          {issue.title}
                        </h3>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: style.bg, color: style.text }}
                        >
                          {style.label}
                        </span>
                        {issue.affected_count > 0 ? (
                          <span className="text-[11px] text-gray-500">
                            {issue.affected_count}{" "}
                            {issue.affected_count === 1 ? "page" : "pages"}
                          </span>
                        ) : null}
                      </div>
                      {issue.what_it_means ? (
                        <p className="text-[13px] leading-relaxed text-gray-700">
                          {issue.what_it_means}
                        </p>
                      ) : null}
                      {issue.why_it_matters ? (
                        <p className="text-[13px] leading-relaxed text-gray-600">
                          <span className="font-medium text-gray-700">Why it matters: </span>
                          {issue.why_it_matters}
                        </p>
                      ) : null}
                      {issue.how_to_fix ? (
                        <p className="text-[13px] leading-relaxed text-gray-600">
                          <span className="font-medium text-gray-700">The fix: </span>
                          {issue.how_to_fix}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      ) : null}

      {gapClusters.length || opportunities.length || run.summary.opportunities?.length ? (
        <Section
          title="The opportunity"
          subtitle="Demand that exists today and is not being captured."
        >
          {run.summary.opportunities?.length ? (
            <ul className="space-y-1.5">
              {run.summary.opportunities.map((o) => (
                <li key={o} className="text-[13px] leading-relaxed text-gray-700">
                  • {o}
                </li>
              ))}
            </ul>
          ) : null}

          {gapClusters.length ? (
            <div className="space-y-3 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Topics people search for with no page answering them
              </div>
              {gapClusters.map(([name, items]) => (
                <div key={name} className="break-inside-avoid">
                  <div className="text-[13px] font-semibold capitalize text-gray-900">
                    {name}
                    <span className="ml-2 text-[11px] font-normal text-gray-400">
                      {items.length} searches
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-gray-600">
                    {items
                      .slice(0, 4)
                      .map((q) => `“${q.query}”`)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-gray-400">
                Collected from Google, Bing and YouTube autocomplete plus public discussion
                forums. These are real searches, in the wording people use.
              </p>
            </div>
          ) : null}
        </Section>
      ) : null}

      {roadmap.length ? (
        <Section
          title="Recommended plan"
          subtitle="Sequenced so blockers clear first, existing traction is strengthened next, and new content builds on a working foundation."
        >
          <div className="space-y-5">
            {(["30", "60", "90"] as const).map((horizon) => {
              const items = roadmap.filter((r) => r.horizon === horizon);
              if (!items.length) return null;
              return (
                <div key={horizon} className="break-inside-avoid space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    {horizon === "30"
                      ? "First 30 days"
                      : horizon === "60"
                        ? "Days 30-60"
                        : "Days 60-90"}
                  </div>
                  {items.map((item, i) => (
                    <div key={`${item.title}-${i}`} className="pl-3">
                      <div className="text-[13px] font-semibold text-gray-900">
                        {item.title}
                      </div>
                      {item.detail ? (
                        <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600">
                          {item.detail}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {item.impact} impact · {item.effort} effort
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Section>
      ) : null}

      {run.summary.unavailable?.length ? (
        <Section
          title="What this audit does not cover"
          subtitle="Stated plainly rather than left as gaps in the data."
        >
          <ul className="space-y-2">
            {run.summary.unavailable.map((u) => (
              <li key={u.source} className="text-[12px] leading-relaxed text-gray-600">
                <span className="font-semibold text-gray-800">{u.source}: </span>
                {u.reason}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <footer className="border-t border-gray-200 pt-6 text-[11px] text-gray-400">
        Prepared by WIDE · wide-communication.com · Data collected{" "}
        {new Date(run.finished_at ?? run.created_at).toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </footer>
    </div>
  );
}
