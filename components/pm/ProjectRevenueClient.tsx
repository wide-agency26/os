"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { PM_ICONS } from "@/lib/pm/icons";
import {
  formatEuro,
  pillarFromStage,
  stagePillarLabel,
} from "@/lib/accounting/types";
import {
  asFinanceFrequency,
  financeYearBooked,
  type FinanceFrequency,
} from "@/lib/accounting/finance";
import {
  deleteProjectRevenueLine,
  saveProjectRevenueLine,
  updateProjectDealValue,
} from "@/app/actions/accounting";
import { Loader2 } from "lucide-react";
import {
  FrequencyToggle,
  ProjectFinanceLinesPanel,
  type FinanceLine,
} from "@/components/pm/ProjectFinanceLinesPanel";

type Props = { projectId: string };

export function ProjectRevenueClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [lines, setLines] = useState<FinanceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dealInput, setDealInput] = useState("");
  const [dealFrequency, setDealFrequency] = useState<FinanceFrequency>("one_off");
  const [dealFrom, setDealFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dealTo, setDealTo] = useState("");

  async function reload() {
    const supabase = createClient();
    const { data: proj } = await (supabase as any)
      .from("projects")
      .select(
        `id, title, stage, deal_value, deal_frequency, deal_end_date, expected_start_date, start_date, client:client_id ( company, name )`
      )
      .eq("id", projectId)
      .single();
    setProject(proj);
    setDealInput(
      proj?.deal_value != null && proj.deal_value !== ""
        ? String(proj.deal_value)
        : ""
    );
    setDealFrequency(asFinanceFrequency(proj?.deal_frequency));
    setDealFrom(
      proj?.expected_start_date ||
        proj?.start_date ||
        new Date().toISOString().slice(0, 10)
    );
    setDealTo(proj?.deal_end_date || "");

    const { data } = await (supabase as any)
      .from("project_revenue_lines")
      .select("id, label, amount, entry_date, category, notes, frequency, effective_to")
      .eq("project_id", projectId)
      .order("entry_date", { ascending: false });
    setLines((data || []) as FinanceLine[]);
  }

  useEffect(() => {
    void (async () => {
      await reload();
      setLoading(false);
    })();
  }, [projectId]);

  const year = new Date().getFullYear();
  const totals = useMemo(() => {
    const dealRate = Number(project?.deal_value || 0);
    const dealBooked = financeYearBooked(
      dealRate,
      project?.deal_frequency,
      project?.expected_start_date || project?.start_date,
      project?.deal_end_date,
      year
    );
    const extraBooked = lines.reduce(
      (s, l) =>
        s +
        financeYearBooked(
          Number(l.amount || 0),
          l.frequency,
          l.entry_date,
          l.effective_to,
          year
        ),
      0
    );
    return {
      dealRate: Math.round(dealRate * 100) / 100,
      dealBooked: Math.round(dealBooked * 100) / 100,
      extra: Math.round(extraBooked * 100) / 100,
      total: Math.round((dealBooked + extraBooked) * 100) / 100,
    };
  }, [project, lines, year]);

  const accountingHref = (() => {
    const pillar = pillarFromStage(project?.stage);
    if (pillar === "identified") return "/app/accounting/identified";
    if (pillar === "unidentified") return "/app/accounting/unidentified";
    return "/app/accounting/actual";
  })();

  const handleSaveDeal = async () => {
    setSaving(true);
    const val =
      dealInput.trim() === "" ? null : Number(dealInput.replace(",", "."));
    if (val != null && !Number.isFinite(val)) {
      setSaving(false);
      alert("Enter a valid deal value.");
      return;
    }
    const res = await updateProjectDealValue(projectId, val, {
      frequency: dealFrequency,
      startDate: dealFrom,
      endDate: dealTo || null,
    });
    setSaving(false);
    if (!res.ok) {
      alert(res.error || "Failed to save deal value");
      return;
    }
    await reload();
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500 p-6">Loading revenue center…</div>
    );
  }

  const Icon = PM_ICONS.revenueCenter;
  const dealIsMonthly = dealFrequency === "monthly";

  return (
    <ProjectPmShell
      projectId={projectId}
      title={project?.title || "Project"}
      clientLabel={project?.client?.company || project?.client?.name}
    >
      <p className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-2">
        <Icon className="w-4 h-4" />
        Revenue posts to{" "}
        <span className="font-medium text-gray-800">
          {stagePillarLabel(project?.stage)}
        </span>{" "}
        based on project stage (Prospect → Unidentified · Lead → Identified ·
        Client → Actual). Edit type and dates here — accounting updates
        immediately.
        <Link
          href={accountingHref}
          className="text-blue-600 hover:underline text-xs"
        >
          Open ledger →
        </Link>
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Deal {dealIsMonthly ? "monthly" : "one-off"}
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">
            {formatEuro(totals.dealRate)}
            {dealIsMonthly ? (
              <span className="text-sm font-medium text-gray-400"> /mo</span>
            ) : null}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Extra in {year}
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">
            {formatEuro(totals.extra)}
          </p>
        </div>
        <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/40">
          <p className="text-xs text-emerald-800 uppercase tracking-wide">
            {year} → {stagePillarLabel(project?.stage)}
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums text-emerald-950">
            {formatEuro(totals.total)}
          </p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-3 py-2 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
          Primary deal value
        </div>
        <div className="p-3 space-y-3">
          <FrequencyToggle
            value={dealFrequency}
            onChange={(frequency) => {
              setDealFrequency(frequency);
              if (frequency === "one_off") setDealTo("");
            }}
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[8rem]">
              <label className="block text-[11px] text-gray-500 mb-1">
                Amount (€{dealIsMonthly ? " / month" : ""})
              </label>
              <input
                type="number"
                step="0.01"
                value={dealInput}
                onChange={(e) => setDealInput(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                placeholder="0"
              />
            </div>
            <div className="min-w-[9rem]">
              <label className="block text-[11px] text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={dealFrom}
                onChange={(e) => setDealFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
              />
            </div>
            {dealIsMonthly ? (
              <div className="min-w-[9rem]">
                <label className="block text-[11px] text-gray-500 mb-1">
                  To (empty = Dec)
                </label>
                <input
                  type="date"
                  value={dealTo}
                  onChange={(e) => setDealTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveDeal()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-2 hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save deal
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Works for Prospect, Lead, and Client. Monthly writes one ledger row
            per covered month; one-off writes the From month only.
            {dealIsMonthly && totals.dealBooked
              ? ` ${year} booked: ${formatEuro(totals.dealBooked)}.`
              : ""}
          </p>
        </div>
      </div>

      <ProjectFinanceLinesPanel
        kind="revenue"
        projectId={projectId}
        lines={lines}
        pillarLabel={stagePillarLabel(project?.stage)}
        onSave={async (input) => {
          const res = await saveProjectRevenueLine(input);
          if (res.ok) await reload();
          return res;
        }}
        onDelete={async (id, pid) => {
          const res = await deleteProjectRevenueLine(id, pid);
          if (res.ok) await reload();
          return res;
        }}
      />
    </ProjectPmShell>
  );
}
