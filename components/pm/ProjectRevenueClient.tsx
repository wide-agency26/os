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
  deleteProjectRevenueLine,
  saveProjectRevenueLine,
  updateProjectDealValue,
} from "@/app/actions/accounting";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Props = { projectId: string };

type RevLine = {
  id: string;
  label: string;
  amount: number;
  entry_date: string;
  category: string;
  notes: string | null;
};

export function ProjectRevenueClient({ projectId }: Props) {
  const [project, setProject] = useState<any>(null);
  const [lines, setLines] = useState<RevLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dealInput, setDealInput] = useState("");
  const [form, setForm] = useState({
    label: "",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    category: "Revenue",
  });

  async function reload() {
    const supabase = createClient();
    const { data: proj } = await (supabase as any)
      .from("projects")
      .select(
        `id, title, stage, deal_value, expected_start_date, client:client_id ( company, name )`
      )
      .eq("id", projectId)
      .single();
    setProject(proj);
    setDealInput(
      proj?.deal_value != null && proj.deal_value !== ""
        ? String(proj.deal_value)
        : ""
    );

    const { data } = await (supabase as any)
      .from("project_revenue_lines")
      .select("id, label, amount, entry_date, category, notes")
      .eq("project_id", projectId)
      .order("entry_date", { ascending: false });
    setLines((data || []) as RevLine[]);
  }

  useEffect(() => {
    void (async () => {
      await reload();
      setLoading(false);
    })();
  }, [projectId]);

  const totals = useMemo(() => {
    const deal = Number(project?.deal_value || 0);
    const extra = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    const total = Math.round((deal + extra) * 100) / 100;
    return {
      deal: Math.round(deal * 100) / 100,
      extra: Math.round(extra * 100) / 100,
      total,
    };
  }, [project, lines]);

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
    const res = await updateProjectDealValue(projectId, val);
    setSaving(false);
    if (!res.ok) {
      alert(res.error || "Failed to save deal value");
      return;
    }
    await reload();
  };

  const handleAddLine = async () => {
    const amount = Number(form.amount);
    if (!form.label.trim() || !Number.isFinite(amount) || amount === 0) {
      alert("Enter a label and a non-zero amount.");
      return;
    }
    setSaving(true);
    const res = await saveProjectRevenueLine({
      project_id: projectId,
      label: form.label,
      amount,
      entry_date: form.entry_date,
      category: form.category,
    });
    setSaving(false);
    if (!res.ok) {
      alert(res.error || "Failed to save");
      return;
    }
    setForm({
      label: "",
      amount: "",
      entry_date: new Date().toISOString().slice(0, 10),
      category: "Revenue",
    });
    await reload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this revenue line?")) return;
    setSaving(true);
    const res = await deleteProjectRevenueLine(id, projectId);
    setSaving(false);
    if (!res.ok) {
      alert(res.error || "Failed to delete");
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
        Client → Actual)
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
            Deal value
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">
            {formatEuro(totals.deal)}
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Extra lines
          </p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">
            {formatEuro(totals.extra)}
          </p>
        </div>
        <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/40">
          <p className="text-xs text-emerald-800 uppercase tracking-wide">
            Total → {stagePillarLabel(project?.stage)}
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
        <div className="p-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-[11px] text-gray-500 mb-1">
              Amount (€)
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
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveDeal()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save deal value
          </button>
        </div>
        <p className="px-3 pb-3 text-[11px] text-gray-400">
          Also editable on the project form. Syncs as auto revenue for this
          project&apos;s accounting pillar.
        </p>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
          Additional revenue lines
        </div>
        <div className="p-3 border-b border-gray-100 grid gap-2 sm:grid-cols-5">
          <input
            type="text"
            placeholder="Label (e.g. Phase 2 retainer)"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="sm:col-span-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Amount €"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <input
            type="date"
            value={form.entry_date}
            onChange={(e) =>
              setForm((f) => ({ ...f, entry_date: e.target.value }))
            }
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleAddLine()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold px-3 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Add
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="px-3 py-4 text-[13px] text-gray-500">
            Optional add-ons beyond deal value. Each line syncs into{" "}
            {stagePillarLabel(project?.stage)} revenue.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {line.label}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {line.entry_date} · {line.category}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="tabular-nums font-semibold text-emerald-600">
                    +{formatEuro(line.amount)}
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete(line.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProjectPmShell>
  );
}
