"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { formatEuro } from "@/lib/accounting/types";
import type { ProjectionBoard } from "@/lib/accounting/load-projections";
import {
  applyGoalSeek,
  computeScenario,
  groupLines,
  PROJECTION_YEARS,
  QUARTERLY_YEAR,
  yearIsOpen,
  type GoalSeekInput,
  type ProjectionAssumption,
  type ProjectionYear,
} from "@/lib/accounting/projections";
import {
  applyGoalSeekToYear,
  clearPushedProjectionYear,
  freezeProjectionYear,
  pushProjectionYear,
  saveProjectionAssumption,
  saveProjectionCapacity,
} from "@/app/actions/projections";

const STROKE = ["#111827", "#6b7280", "#9ca3af"];

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function NumField({
  value,
  onCommit,
  className,
  placeholder = "—",
}: {
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = parseNum(text);
        setText(next == null ? "" : String(next));
        onCommit(next);
      }}
      className={`w-full bg-transparent text-right tabular-nums text-[13px] text-gray-900 outline-none border-b border-transparent focus:border-gray-400 ${className || ""}`}
    />
  );
}

function TextField({
  value,
  onCommit,
  placeholder,
}: {
  value: string | null | undefined;
  onCommit: (v: string | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value || "");
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text.trim() || null)}
      className="w-full bg-transparent text-[13px] text-gray-900 outline-none border-b border-transparent focus:border-gray-400"
    />
  );
}

export function ProjectionsClient({ board }: { board: ProjectionBoard }) {
  const router = useRouter();
  const defaultScenario =
    board.scenarios.find((s) => s.is_default) || board.scenarios[0];
  const [scenarioId, setScenarioId] = useState(defaultScenario?.id || "");
  const [year, setYear] = useState<ProjectionYear>(2027);
  const [assumptions, setAssumptions] = useState<ProjectionAssumption[]>(
    board.assumptions
  );
  const [openTier, setOpenTier] = useState<string | null>(null);
  const [metric, setMetric] = useState<"profit" | "revenue" | "cost">("profit");
  const [seek, setSeek] = useState<GoalSeekInput>({
    volumeMul: 1,
    dealMul: 1,
    mix: 0.5,
  });
  const [target, setTarget] = useState("");
  const [targetMetric, setTargetMetric] = useState<"profit" | "revenue">("profit");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const scenario = board.scenarios.find((s) => s.id === scenarioId) || defaultScenario;

  const computed = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeScenario>> = {};
    for (const sc of board.scenarios) {
      map[sc.id] = computeScenario({
        scenario: sc,
        tiers: board.tiers,
        assumptions,
      });
    }
    return map;
  }, [board.scenarios, board.tiers, assumptions]);

  const years = computed[scenarioId] || [];
  const yearRow = years.find((y) => y.year === year);
  const snapshot = board.snapshots.find(
    (s) => s.scenario_id === scenarioId && s.year === year
  );
  const cap = board.capacity.find(
    (c) => c.scenario_id === scenarioId && c.year === year
  );
  const pushed =
    board.settings.pushed_scenario_id === scenarioId &&
    board.settings.pushed_years.includes(year);

  const seeked = yearRow ? applyGoalSeek(yearRow, seek) : null;
  const targetVal = parseNum(target);
  const liveMetric = seeked ? seeked[targetMetric] : 0;
  const gap = targetVal == null ? null : liveMetric - targetVal;

  const chartData = PROJECTION_YEARS.map((y) => {
    const row: Record<string, number | string> = { year: String(y) };
    board.scenarios.forEach((sc, i) => {
      const yr = computed[sc.id]?.find((r) => r.year === y);
      row[sc.slug] = yr ? yr[metric] : 0;
      if (i === 0) {
        const snap = board.snapshots.find(
          (s) => s.scenario_id === sc.id && s.year === y
        );
        if (snap) row.baseline = snap.payload[metric];
      }
    });
    return row;
  });

  function patchAssumption(
    tierId: string,
    patch: Partial<ProjectionAssumption>
  ) {
    setAssumptions((prev) => {
      const idx = prev.findIndex(
        (a) => a.scenario_id === scenarioId && a.tier_id === tierId && a.year === year
      );
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [
        ...prev,
        {
          id: `local-${tierId}-${year}`,
          scenario_id: scenarioId,
          tier_id: tierId,
          year,
          target_segment: null,
          market_size: null,
          penetration_pct: null,
          avg_deal_value: null,
          growth_pct: null,
          source_note: null,
          units: null,
          q1: null,
          q2: null,
          q3: null,
          q4: null,
          ...patch,
        },
      ];
    });
    startTransition(async () => {
      const res = await saveProjectionAssumption({
        scenarioId,
        tierId,
        year,
        patch,
      });
      if (!res.ok) setMessage(res.error);
    });
  }

  const groups = yearRow ? groupLines(yearRow.lines) : [];
  const fte = cap?.fte ?? board.hr.activePeople;
  const maxProjects = cap?.max_projects ?? Math.max(1, fte * 4);
  const overCap = (yearRow?.packageClients || 0) > maxProjects + 0.01;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Accounting · Unidentified engine
          </p>
          <h1 className="text-2xl font-semibold text-gray-950 tracking-tight">
            Projections
          </h1>
          <p className="mt-1 text-sm text-gray-600 max-w-2xl">
            2027–2031, from the catalog and the 5-year P&L sheet. 2027 is
            quarterly; later years are annual. Push a year into Unidentified
            when you want the dashboard and runway to see it.
          </p>
        </div>
        <Link
          href="/app/accounting/unidentified"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-700 hover:underline"
        >
          Unidentified ledger <ArrowRight size={14} />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {board.scenarios.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => setScenarioId(sc.id)}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
              sc.id === scenarioId
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {sc.name}
          </button>
        ))}
        <span className="mx-1 text-gray-300">|</span>
        {PROJECTION_YEARS.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYear(y)}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
              year === y
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {y}
            {y === QUARTERLY_YEAR ? (
              <span className="ml-1 font-normal opacity-70">Q</span>
            ) : null}
          </button>
        ))}
      </div>

      {message ? (
        <p className="text-[13px] text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {message}
        </p>
      ) : null}

      {yearRow ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Revenue" value={yearRow.revenue} />
          <SummaryCard label="Cost" value={yearRow.cost} />
          <SummaryCard label="Profit" value={yearRow.profit} emphasize />
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              vs frozen
            </p>
            {snapshot ? (
              <>
                <p
                  className={`text-lg font-semibold tabular-nums mt-1 ${
                    yearRow.profit - snapshot.payload.profit >= 0
                      ? "text-gray-950"
                      : "text-red-700"
                  }`}
                >
                  {formatEuro(yearRow.profit - snapshot.payload.profit)}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Baseline {formatEuro(snapshot.payload.profit)}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-gray-400 mt-1">—</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {yearIsOpen(year)
                    ? "Year has started — freeze a baseline"
                    : "Freeze when this year starts"}
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-[13px] font-semibold text-gray-900">
            {fte} FTE
            <span className="font-normal text-gray-500">
              {" · "}
              {yearRow ? `${yearRow.packageClients.toFixed(1)} package clients` : ""}
              {yearRow ? ` · ${yearRow.serviceDeals.toFixed(0)} service deals` : ""}
              {` · cap ${maxProjects} projects`}
            </span>
          </p>
          {overCap ? (
            <p className="text-[12px] font-medium text-amber-800">
              Volume is above the capacity cap — either raise the cap or cut units.
            </p>
          ) : (
            <p className="text-[12px] text-gray-400">
              HR roster now: {board.hr.activePeople} active ·{" "}
              {formatEuro(board.hr.monthlyFullyLoaded)}/mo fully loaded
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg">
          <label className="text-[11px] text-gray-500">
            FTE override
            <NumField
              value={cap?.fte ?? null}
              onCommit={(v) => {
                startTransition(async () => {
                  await saveProjectionCapacity({
                    scenarioId,
                    year,
                    fte: v,
                    max_projects: cap?.max_projects ?? null,
                    notes: cap?.notes ?? null,
                  });
                });
              }}
            />
          </label>
          <label className="text-[11px] text-gray-500">
            Max projects
            <NumField
              value={cap?.max_projects ?? null}
              onCommit={(v) => {
                startTransition(async () => {
                  await saveProjectionCapacity({
                    scenarioId,
                    year,
                    fte: cap?.fte ?? null,
                    max_projects: v,
                    notes: cap?.notes ?? null,
                  });
                });
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-gray-900">Five-year trend</p>
          <div className="flex gap-1">
            {(["profit", "revenue", "cost"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                  metric === m ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) =>
                  `${Math.round(Number(v) / 1000)}k`
                }
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip
                formatter={(v) => formatEuro(Number(v))}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#e5e7eb" }}
              />
              {board.scenarios.map((sc, i) => (
                <Line
                  key={sc.id}
                  type="monotone"
                  dataKey={sc.slug}
                  name={sc.name}
                  stroke={STROKE[i] || "#9ca3af"}
                  strokeWidth={sc.id === scenarioId ? 2.5 : 1.25}
                  strokeDasharray={sc.id === scenarioId ? undefined : "4 3"}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-900">
            {scenario?.name} · {year}
            {year === QUARTERLY_YEAR ? " · quarterly" : " · annual"}
          </p>
          <p className="text-[12px] text-gray-400">
            Click a row for market assumptions. Conservative / Aggressive swap catalog Low vs High.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Line</th>
              <th className="px-3 py-2 font-semibold text-right">Units</th>
              {year === QUARTERLY_YEAR ? (
                <>
                  <th className="px-2 py-2 font-semibold text-right">Q1</th>
                  <th className="px-2 py-2 font-semibold text-right">Q2</th>
                  <th className="px-2 py-2 font-semibold text-right">Q3</th>
                  <th className="px-2 py-2 font-semibold text-right">Q4</th>
                </>
              ) : (
                <th className="px-3 py-2 font-semibold text-right">Growth %</th>
              )}
              <th className="px-3 py-2 font-semibold text-right">Deal €</th>
              <th className="px-4 py-2 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows
                key={g.label}
                label={g.label}
                lines={g.lines}
                year={year}
                openTier={openTier}
                setOpenTier={setOpenTier}
                onPatch={patchAssumption}
                resetKey={`${scenarioId}-${year}`}
              />
            ))}
          </tbody>
        </table>
      </div>

      {seeked && yearRow ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-[13px] font-semibold text-gray-900">Goal-seek</p>
          <p className="text-[12px] text-gray-500 mt-0.5 mb-3">
            Live recompute — does not write until you apply. Mix leans volume between services and packages.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-[12px] text-gray-600">
                Target {targetMetric} {year}
                <span className="ml-2 inline-flex gap-1">
                  {(["profit", "revenue"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTargetMetric(m)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-semibold capitalize ${
                        targetMetric === m ? "bg-gray-900 text-white" : "text-gray-500"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </span>
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={String(Math.round(yearRow[targetMetric]))}
                  className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-[13px] tabular-nums"
                />
              </label>
              <Slider
                label={`Volume × ${seek.volumeMul.toFixed(2)}`}
                min={0.25}
                max={2.5}
                step={0.05}
                value={seek.volumeMul}
                onChange={(volumeMul) => setSeek((s) => ({ ...s, volumeMul }))}
              />
              <Slider
                label={`Deal size × ${seek.dealMul.toFixed(2)}`}
                min={0.5}
                max={2}
                step={0.05}
                value={seek.dealMul}
                onChange={(dealMul) => setSeek((s) => ({ ...s, dealMul }))}
              />
              <Slider
                label={
                  seek.mix < 0.45
                    ? "Mix · lean services"
                    : seek.mix > 0.55
                      ? "Mix · lean packages"
                      : "Mix · as modelled"
                }
                min={0}
                max={1}
                step={0.05}
                value={seek.mix}
                onChange={(mix) => setSeek((s) => ({ ...s, mix }))}
              />
            </div>
            <div className="rounded-md bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                With these sliders
              </p>
              <p className="text-xl font-semibold tabular-nums text-gray-950 mt-1">
                {formatEuro(seeked[targetMetric])}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                Profit {formatEuro(seeked.profit)} · Rev {formatEuro(seeked.revenue)} · Cost{" "}
                {formatEuro(seeked.cost)}
              </p>
              {gap != null ? (
                <p
                  className={`text-[13px] font-medium mt-2 ${
                    gap >= 0 ? "text-gray-900" : "text-red-700"
                  }`}
                >
                  {gap >= 0 ? "Over target " : "Short "}
                  {formatEuro(Math.abs(gap))}
                </p>
              ) : (
                <p className="text-[12px] text-gray-400 mt-2">
                  Enter a target to see the gap.
                </p>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await applyGoalSeekToYear({
                      scenarioId,
                      year,
                      ...seek,
                    });
                    if (!res.ok) setMessage(res.error);
                    else {
                      setMessage(null);
                      if (seeked) {
                        setAssumptions((prev) =>
                          prev.map((a) => {
                            if (a.scenario_id !== scenarioId || a.year !== year) return a;
                            const line = seeked.lines.find((l) => l.tier.id === a.tier_id);
                            if (!line) return a;
                            return {
                              ...a,
                              units: Math.round(line.units * 100) / 100,
                              avg_deal_value: Math.round(line.deal * 100) / 100,
                            };
                          })
                        );
                      }
                      router.refresh();
                    }
                  });
                }}
                className="mt-3 rounded-md bg-gray-900 text-white text-[12px] font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                Write this mix into {year}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const res = await pushProjectionYear(scenarioId, year);
              if (!res.ok) setMessage(res.error);
              else {
                setMessage(null);
                router.refresh();
              }
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 text-white text-[12px] font-semibold px-3 py-2 disabled:opacity-50"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : null}
          Push {year} to Unidentified
        </button>
        {pushed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await clearPushedProjectionYear(year);
                if (!res.ok) setMessage(res.error);
                else router.refresh();
              });
            }}
            className="rounded-md border border-gray-200 text-[12px] font-semibold px-3 py-2 text-gray-700 hover:bg-gray-50"
          >
            Remove {year} from Unidentified
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const res = await freezeProjectionYear(scenarioId, year);
              if (!res.ok) setMessage(res.error);
              else {
                setMessage(null);
                router.refresh();
              }
            });
          }}
          className="rounded-md border border-gray-200 text-[12px] font-semibold px-3 py-2 text-gray-700 hover:bg-gray-50"
        >
          Freeze {year} as baseline
        </button>
        {pushed ? (
          <span className="text-[12px] text-gray-500">
            {scenario?.name} {year} is currently in Unidentified.
          </span>
        ) : (
          <span className="text-[12px] text-gray-400">
            Push replaces any previous projection rows for this year only.
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`text-lg font-semibold tabular-nums mt-1 ${
          emphasize && value < 0 ? "text-red-700" : "text-gray-950"
        }`}
      >
        {formatEuro(value)}
      </p>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[12px] text-gray-600">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full"
      />
    </label>
  );
}

function GroupRows({
  label,
  lines,
  year,
  openTier,
  setOpenTier,
  onPatch,
  resetKey,
}: {
  label: string;
  lines: ReturnType<typeof groupLines>[number]["lines"];
  year: number;
  openTier: string | null;
  setOpenTier: (id: string | null) => void;
  onPatch: (tierId: string, patch: Partial<ProjectionAssumption>) => void;
  resetKey: string;
}) {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <>
      <tr className="bg-gray-50/80">
        <td
          colSpan={year === QUARTERLY_YEAR ? 8 : 5}
          className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
        >
          {label}
          <span className="ml-2 font-normal tabular-nums text-gray-400">
            {formatEuro(total)}
          </span>
        </td>
      </tr>
      {lines.map((line) => {
        const open = openTier === line.tier.id;
        const a = line.assumption;
        const span = year === QUARTERLY_YEAR ? 8 : 5;
        return (
          <Fragment key={line.tier.id}>
            <tr
              className={`cursor-pointer ${open ? "bg-gray-50" : "hover:bg-gray-50/80"}`}
              onClick={() => setOpenTier(open ? null : line.tier.id)}
            >
              <td className="px-4 py-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {open ? (
                    <ChevronDown size={12} className="text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight size={12} className="text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 truncate">
                      {line.tier.name}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {line.tier.billing === "monthly"
                        ? `${line.tier.months_per_deal} mo retainer`
                        : "One-off"}
                      {line.unitsInherited ? " · via growth" : ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <NumField
                  key={`${resetKey}-${line.tier.id}-units`}
                  value={a?.units ?? (line.unitsInherited ? null : line.units)}
                  placeholder={line.unitsInherited ? line.units.toFixed(1) : "0"}
                  onCommit={(v) => onPatch(line.tier.id, { units: v })}
                />
              </td>
              {year === QUARTERLY_YEAR ? (
                (["q1", "q2", "q3", "q4"] as const).map((q) => (
                  <td key={q} className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <NumField
                      value={a?.[q] ?? null}
                      placeholder={line.quarters ? line.quarters[q].toFixed(1) : "—"}
                      onCommit={(v) => onPatch(line.tier.id, { [q]: v })}
                    />
                  </td>
                ))
              ) : (
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <NumField
                    value={a?.growth_pct ?? null}
                    placeholder="0"
                    onCommit={(v) => onPatch(line.tier.id, { growth_pct: v })}
                  />
                </td>
              )}
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <NumField
                  value={a?.avg_deal_value ?? null}
                  placeholder={String(Math.round(line.deal))}
                  onCommit={(v) => onPatch(line.tier.id, { avg_deal_value: v })}
                />
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                {formatEuro(line.amount)}
              </td>
            </tr>
            {open ? (
              <tr className="bg-gray-50">
                <td colSpan={span} className="px-4 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <label className="text-[11px] text-gray-500">
                      Segment
                      <TextField
                        value={a?.target_segment}
                        placeholder="e.g. DACH seed / Series A"
                        onCommit={(v) => onPatch(line.tier.id, { target_segment: v })}
                      />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      Addressable market (#)
                      <NumField
                        value={a?.market_size ?? null}
                        onCommit={(v) => onPatch(line.tier.id, { market_size: v })}
                      />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      Penetration %
                      <NumField
                        value={a?.penetration_pct ?? null}
                        onCommit={(v) => onPatch(line.tier.id, { penetration_pct: v })}
                      />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      Growth % to next year
                      <NumField
                        value={a?.growth_pct ?? null}
                        onCommit={(v) => onPatch(line.tier.id, { growth_pct: v })}
                      />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      Source note
                      <TextField
                        value={a?.source_note}
                        placeholder="Why this number"
                        onCommit={(v) => onPatch(line.tier.id, { source_note: v })}
                      />
                    </label>
                  </div>
                  {line.suggestedUnits != null ? (
                    <button
                      type="button"
                      className="mt-2 text-[12px] font-medium text-blue-700 hover:underline"
                      onClick={() =>
                        onPatch(line.tier.id, { units: line.suggestedUnits })
                      }
                    >
                      Use suggested units ({line.suggestedUnits})
                    </button>
                  ) : (
                    <p className="mt-2 text-[11px] text-gray-400">
                      Market × penetration suggests units when both are filled.
                    </p>
                  )}
                </td>
              </tr>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}
