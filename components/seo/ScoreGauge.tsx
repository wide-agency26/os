"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import { scoreBand } from "@/lib/seo/constants";
import type { SeoScores } from "@/lib/seo/types";
import { Card, Chip, SectionLabel, TONE_HEX, scoreTone } from "./primitives";

export function ScoreGauge({
  score,
  previousScore,
}: {
  score: number | null;
  previousScore: number | null;
}) {
  const value = score ?? 0;
  const band = scoreBand(score);
  const tone = scoreTone(score);
  const delta = score !== null && previousScore !== null ? score - previousScore : null;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={[{ name: "score", value }]}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={12}
              fill={TONE_HEX[tone]}
              background={{ fill: "#f3f4f6" }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-semibold tabular-nums text-gray-900">
            {score === null ? "—" : score}
          </div>
          <div className="text-[11px] font-medium text-gray-400">out of 100</div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Chip tone={tone}>{band.label}</Chip>
        {delta !== null && delta !== 0 ? (
          <span
            className={`text-[12px] font-semibold ${
              delta > 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta} vs. last audit
          </span>
        ) : null}
      </div>
    </div>
  );
}

const PILLAR_META: {
  key: keyof SeoScores;
  label: string;
  explanation: string;
}[] = [
  {
    key: "technical",
    label: "Technical",
    explanation: "Can search engines reach, read and index the site properly?",
  },
  {
    key: "content",
    label: "Content",
    explanation: "Are titles, headings and page content clear, unique and complete?",
  },
  {
    key: "performance",
    label: "Performance",
    explanation: "How fast and stable the site feels to a real visitor.",
  },
  {
    key: "search_presence",
    label: "Search presence",
    explanation: "How the site actually performs in search results today.",
  },
];

export function PillarBars({ scores }: { scores: SeoScores | null }) {
  if (!scores) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PILLAR_META.map((pillar) => {
        const unavailable = scores.unavailable?.includes(pillar.key as string);
        const raw = scores[pillar.key];
        const value = typeof raw === "number" ? raw : null;
        const tone = unavailable ? "muted" : scoreTone(value);
        const band = unavailable ? { label: "Not measured" } : scoreBand(value);

        return (
          <Card key={pillar.key} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>{pillar.label}</SectionLabel>
              <Chip tone={tone}>{band.label}</Chip>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums text-gray-900">
                {unavailable || value === null ? "—" : value}
              </span>
              {!unavailable && value !== null ? (
                <span className="text-[12px] text-gray-400">/ 100</span>
              ) : null}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${unavailable ? 0 : (value ?? 0)}%`,
                  backgroundColor: TONE_HEX[tone],
                }}
              />
            </div>
            <p className="text-[12px] leading-relaxed text-gray-600">
              {unavailable
                ? "This pillar was not measured in this run, so it is excluded from the overall score rather than counted as zero."
                : pillar.explanation}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
