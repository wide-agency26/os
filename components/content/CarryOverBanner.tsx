"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  carryOverContentPost,
  dropMissedContentPost,
  markContentPostPosted,
} from "@/app/actions/content-calendar";
import { defaultCarryOverDate, contentToday } from "@/lib/content/calendar-day";
import { postLabel, type ContentPost } from "@/lib/content/types";
import { PlatformIcon } from "./PlatformMockups";

export function CarryOverBanner({
  projectId,
  posts,
}: {
  projectId: string;
  posts: ContentPost[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dates, setDates] = useState<Record<string, string>>(() => {
    const t = defaultCarryOverDate();
    const m: Record<string, string> = {};
    for (const p of posts) m[p.id] = t;
    return m;
  });
  const [permalinks, setPermalinks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const today = contentToday();

  if (!posts.length) return null;

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

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">
            Carry over
          </p>
          <p className="text-[13px] text-amber-950 mt-0.5">
            {posts.length} planned post{posts.length === 1 ? "" : "s"} before {today} were not
            marked Live and were not found on Instagram. Where do you want to carry over these
            ideas?
          </p>
        </div>
      </div>
      {msg ? (
        <p className="mt-2 text-[12px] text-amber-900 border border-amber-200/80 rounded px-2 py-1 bg-white/60">
          {msg}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {posts.map((p) => (
          <li
            key={p.id}
            className="rounded-md border border-amber-200/80 bg-white px-2.5 py-2 flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {p.platforms.map((pl) => (
                  <PlatformIcon key={pl} platform={pl} className="w-3 h-3 text-gray-600" />
                ))}
                <span className="text-[11px] font-medium text-gray-500">
                  {postLabel(p.post_number)}
                </span>
                <span className="text-[11px] text-gray-400">was {p.scheduled_date}</span>
              </div>
              <p className="text-[13px] text-gray-900 line-clamp-2 mt-0.5">
                {p.hook_angle || "Untitled angle"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                min={today}
                value={dates[p.id] || today}
                onChange={(e) => setDates((d) => ({ ...d, [p.id]: e.target.value }))}
                className="rounded border border-gray-200 text-[12px] px-2 py-1"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      carryOverContentPost(p.id, projectId, dates[p.id] || today),
                    "Carried over"
                  )
                }
                className="rounded-md bg-amber-900 text-white px-2.5 py-1.5 text-[12px] disabled:opacity-50"
              >
                Carry over
              </button>
              <input
                type="url"
                placeholder="IG permalink (optional)"
                value={permalinks[p.id] || ""}
                onChange={(e) => setPermalinks((m) => ({ ...m, [p.id]: e.target.value }))}
                className="rounded border border-gray-200 text-[12px] px-2 py-1 w-[180px]"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      markContentPostPosted(p.id, projectId, permalinks[p.id] || null),
                    "Marked posted"
                  )
                }
                className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px] disabled:opacity-50"
              >
                Mark posted
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => dropMissedContentPost(p.id, projectId), "Dropped")
                }
                className="rounded-md border border-gray-200 px-2.5 py-1.5 text-[12px] text-gray-600 disabled:opacity-50"
              >
                Drop
              </button>
            </div>
          </li>
        ))}
      </ul>
      {pending ? (
        <p className="mt-2 text-[11px] text-amber-800 inline-flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Saving…
        </p>
      ) : null}
    </div>
  );
}
