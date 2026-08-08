"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PM_ICONS } from "@/lib/pm/icons";
import {
  addTaskTemplate,
  deleteTaskTemplate,
  saveTaskTemplateRow,
} from "@/app/actions/pm";
import { PlaybookStepRaci } from "@/components/hr/PlaybookStepRaci";

export function ServicePlaybookEditor({ playbookId }: { playbookId: string }) {
  const [meta, setMeta] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: pb } = await (supabase as any)
      .from("service_playbooks")
      .select(`id, cadence_type, recurrence_unit, service:service_id ( name, category )`)
      .eq("id", playbookId)
      .single();
    setMeta(pb);

    const { data: templates } = await (supabase as any)
      .from("task_templates")
      .select("*")
      .eq("service_playbook_id", playbookId)
      .order("sort_order", { ascending: true });
    setRows(templates || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [playbookId]);

  const updateLocal = (id: string, patch: Record<string, unknown>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const persist = (id: string, patch: Record<string, unknown>) => {
    startTransition(async () => {
      await saveTaskTemplateRow(id, patch as any);
    });
  };

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading playbook…</div>;
  }

  return (
    <Workspace>
      <div className="mb-4">
        <Link href="/app/playbooks" className="text-sm text-gray-500 hover:text-gray-800">
          ← Playbooks
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">
          {meta?.service?.name || "Service playbook"}
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
          {meta?.cadence_type}
          {meta?.cadence_type === "recurring" ? (
            <PM_ICONS.recurring className="w-3.5 h-3.5" />
          ) : null}
          {meta?.recurrence_unit ? ` · ${meta.recurrence_unit}` : null}
        </p>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2">Task</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2 w-20">Hours</th>
              <th className="px-2 py-2 w-16">Gate?</th>
              <th className="px-2 py-2 w-16">Recurs?</th>
              <th className="px-2 py-2">Phase</th>
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.id} className="align-top">
                <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                <td className="px-2 py-1.5">
                  <input
                    className="w-full border-0 border-b border-transparent focus:border-gray-300 bg-transparent outline-none"
                    value={r.title}
                    onChange={(e) => updateLocal(r.id, { title: e.target.value })}
                    onBlur={(e) => persist(r.id, { title: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="w-28 border-0 border-b border-transparent focus:border-gray-300 bg-transparent outline-none"
                    value={r.default_role || ""}
                    onChange={(e) => updateLocal(r.id, { default_role: e.target.value })}
                    onBlur={(e) => persist(r.id, { default_role: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    className="w-16 border-0 border-b border-transparent focus:border-gray-300 bg-transparent outline-none"
                    value={r.estimated_duration_hours ?? 0}
                    onChange={(e) =>
                      updateLocal(r.id, {
                        estimated_duration_hours: Number(e.target.value),
                      })
                    }
                    onBlur={(e) =>
                      persist(r.id, {
                        estimated_duration_hours: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={!!r.is_gate}
                    disabled={pending}
                    onChange={(e) => {
                      updateLocal(r.id, { is_gate: e.target.checked });
                      persist(r.id, { is_gate: e.target.checked });
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={!!r.recurs}
                    disabled={pending}
                    onChange={(e) => {
                      updateLocal(r.id, { recurs: e.target.checked });
                      persist(r.id, { recurs: e.target.checked });
                    }}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    className="w-full border-0 border-b border-transparent focus:border-gray-300 bg-transparent outline-none text-xs"
                    value={r.phase_label || ""}
                    onChange={(e) => updateLocal(r.id, { phase_label: e.target.value })}
                    onBlur={(e) => persist(r.id, { phase_label: e.target.value || null })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteTaskTemplate(r.id);
                        await load();
                      })
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">RACI & roster matching</h2>
        <p className="text-[12px] text-gray-500 max-w-2xl">
          Optional skill / engagement filters per step. When projects instantiate this
          playbook, matching active roster people are suggested for assignment — never
          auto-locked.
        </p>
        {rows.map((r) => (
          <div key={`raci-${r.id}`} className="border border-gray-200 rounded-lg p-3">
            <p className="text-[13px] font-medium text-gray-800 mb-2">{r.title || "Untitled"}</p>
            <PlaybookStepRaci taskTemplateId={r.id} />
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={pending}
        className="mt-3 text-sm text-gray-700 underline"
        onClick={() =>
          startTransition(async () => {
            await addTaskTemplate(playbookId, "New task");
            await load();
          })
        }
      >
        + Add row
      </button>
    </Workspace>
  );
}
