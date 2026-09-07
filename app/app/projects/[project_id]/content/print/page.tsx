import { createClient } from "@/utils/supabase/server";
import { loadCalendarBundle } from "@/lib/content/load";
import { calendarToCsv } from "@/lib/content/export";
import { captionAt, monthLabel, monthStart, postLabel } from "@/lib/content/types";
import { redirect } from "next/navigation";
import { PrintBar } from "@/components/content/PrintBar";
import { isFounder } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ContentPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ project_id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { project_id } = await params;
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
  if (!isFounder(profile?.role)) redirect("/app/client-content");

  const periodStart = sp.month && /^\d{4}-\d{2}-01$/.test(sp.month)
    ? sp.month
    : monthStart(new Date());

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", project_id)
    .maybeSingle();

  const bundle = await loadCalendarBundle(supabase, project_id, periodStart);
  const langs = bundle.settings.languages;
  const csv = calendarToCsv(bundle.posts, bundle.settings);

  return (
    <div className="bg-white text-gray-900 p-8 print:p-0">
      <style>{`@media print { nav, aside, .no-print { display: none !important; } }`}</style>
      <PrintBar
        csvHref={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
        filename={`${(project?.title || "content")}-${periodStart.slice(0, 7)}.csv`}
      />
      <h1 className="text-2xl font-semibold">
        {project?.title} — {monthLabel(periodStart)}
      </h1>
      <p className="text-[13px] text-gray-500 mt-1 mb-6">
        Content calendar handoff. Does not publish. {bundle.posts.length} posts.
      </p>
      <div className="space-y-8">
        {bundle.posts.map((post) => (
          <article key={post.id} className="break-inside-avoid border-t border-gray-200 pt-4">
            <h2 className="text-[15px] font-semibold">
              {postLabel(post.post_number)} · {post.scheduled_date} · {post.pillar} ·{" "}
              {post.platforms.join(" + ")}
            </h2>
            <p className="text-[13px] mt-1">{post.hook_angle}</p>
            {post.visual_brief.background || post.visual_brief.graphic_description ? (
              <p className="text-[12px] text-gray-600 mt-2">
                Visual — BG: {post.visual_brief.background} / {post.visual_brief.graphic_description}
              </p>
            ) : null}
            {post.story_repost?.strategy_text ? (
              <p className="text-[12px] mt-1">
                Story: {post.story_repost.strategy_text} ({post.story_repost.sticker_type})
              </p>
            ) : null}
            {langs.map((lang) => (
              <div key={lang} className="mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {lang}
                </div>
                {post.platforms.map((p) => (
                  <pre
                    key={p}
                    className="mt-1 whitespace-pre-wrap text-[12px] font-sans text-gray-800"
                  >
                    <strong>{p}:</strong> {captionAt(post.captions, p, lang)}
                    {"\n"}
                    {captionAt(post.hashtags, p, lang)}
                  </pre>
                ))}
                {post.is_video && post.voiceover_script?.[lang] ? (
                  <p className="text-[12px] mt-1">VO: {post.voiceover_script[lang]}</p>
                ) : null}
              </div>
            ))}
            {post.remarks ? (
              <p className="text-[12px] text-gray-500 mt-2">Internal: {post.remarks}</p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
