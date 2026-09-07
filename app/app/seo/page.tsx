import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Globe, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { RunLauncher } from "@/components/seo/RunLauncher";
import { SiteToggles } from "@/components/seo/SiteToggles";
import { Card, Chip, SectionLabel, scoreTone } from "@/components/seo/primitives";
import { scoreBand } from "@/lib/seo/constants";
import { listSeoSitesAndRuns } from "@/lib/seo/load-run";

export const dynamic = "force-dynamic";

export default async function SeoAuditorPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }

  const { sites, runs } = await listSeoSitesAndRuns();

  return (
    <Workspace wide>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold text-gray-900">SEO Auditor</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-gray-600">
              Deep, background site audits: crawl, diagnose, mine real search demand, and get
              a prioritised plan. Separate from the SEO Report, which covers monthly Search
              Console performance.
            </p>
          </div>
        </div>

        <RunLauncher initialUrl={sp.url ?? ""} />

        {runs.length ? (
          <section className="space-y-3">
            <SectionLabel>Recent audits</SectionLabel>
            <div className="space-y-2">
              {runs.map((run) => {
                const band = scoreBand(run.score);
                const active = run.status === "queued" || run.status === "running";
                return (
                  <Link
                    key={run.id}
                    href={`/app/seo/${run.id}`}
                    className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-all hover:border-gray-300 hover:shadow-sm"
                  >
                    <div className="w-12 shrink-0 text-center">
                      {run.score !== null ? (
                        <>
                          <div className="text-lg font-semibold tabular-nums text-gray-900">
                            {run.score}
                          </div>
                          <div className="text-[10px] text-gray-400">score</div>
                        </>
                      ) : active ? (
                        <Loader2 size={16} className="mx-auto animate-spin text-blue-600" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-gray-900">
                          {run.domain}
                        </span>
                        <Chip
                          tone={
                            run.status === "ready"
                              ? scoreTone(run.score)
                              : run.status === "failed"
                                ? "bad"
                                : run.status === "cancelled"
                                  ? "muted"
                                  : "info"
                          }
                        >
                          {run.status === "ready" ? band.label : run.status}
                        </Chip>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {active
                          ? `${run.progress_pct}% · ${run.phase}`
                          : run.error_message
                            ? run.error_message
                            : `${run.pages_crawled.toLocaleString()} pages · ${new Date(
                                run.created_at
                              ).toLocaleDateString(undefined, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}`}
                      </div>
                    </div>

                    <ArrowRight
                      size={15}
                      className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-600"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {sites.length ? (
          <section className="space-y-3">
            <SectionLabel>Saved sites</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sites.map((site) => (
                <Card key={site.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Globe size={14} className="shrink-0 text-gray-400" />
                      <span className="truncate text-[13px] font-medium text-gray-900">
                        {site.domain}
                      </span>
                    </div>
                    {site.last_score !== null ? (
                      <Chip tone={scoreTone(site.last_score)}>{site.last_score}</Chip>
                    ) : null}
                  </div>
                  <div className="space-y-0.5 text-[11px] text-gray-500">
                    <div>
                      {site.last_run_at
                        ? `Last audited ${new Date(site.last_run_at).toLocaleDateString(
                            undefined,
                            { day: "numeric", month: "short", year: "numeric" }
                          )}`
                        : "Not yet audited"}
                    </div>
                    <div>
                      {site.gsc_property
                        ? "Search Console connected"
                        : "No Search Console property set"}
                    </div>
                  </div>
                  <SiteToggles
                    siteId={site.id}
                    isClientVisible={site.is_client_visible}
                    monthlyRerun={site.monthly_rerun}
                  />
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Workspace>
  );
}
