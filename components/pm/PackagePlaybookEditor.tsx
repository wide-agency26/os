"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { GateIcon } from "@/components/pm/PmBadges";
import { PM_ICONS } from "@/lib/pm/icons";

export function PackagePlaybookEditor({ playbookId }: { playbookId: string }) {
  const [meta, setMeta] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: pb } = await (supabase as any)
        .from("package_playbooks")
        .select(`id, cadence_type, package:package_id ( name, high_level_process )`)
        .eq("id", playbookId)
        .single();
      setMeta(pb);

      const { data: mem } = await (supabase as any)
        .from("package_playbook_members")
        .select(
          `id, sequence_group, parallel, service_playbook:service_playbook_id (
            id, service:service_id ( name )
          )`
        )
        .eq("package_playbook_id", playbookId)
        .order("sequence_group", { ascending: true });
      setMembers(mem || []);

      const { data: g } = await (supabase as any)
        .from("package_playbook_gates")
        .select(
          `id, after_task_template:after_task_template_id ( title ),
           blocks:blocks_service_playbook_id ( service:service_id ( name ) )`
        )
        .eq("package_playbook_id", playbookId);
      setGates(g || []);
      setLoading(false);
    }
    void load();
  }, [playbookId]);

  if (loading) {
    return <div className="text-sm text-gray-500 p-6">Loading package…</div>;
  }

  return (
    <Workspace>
      <div className="mb-4">
        <Link href="/app/playbooks" className="text-sm text-gray-500 hover:text-gray-800">
          ← Playbooks
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">
          {meta?.package?.name || "Package playbook"}
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
          {meta?.cadence_type}
          {meta?.cadence_type === "recurring" ? (
            <PM_ICONS.recurring className="w-3.5 h-3.5" />
          ) : null}
        </p>
      </div>

      {meta?.package?.high_level_process?.length ? (
        <ol className="mb-6 text-sm text-gray-700 list-decimal list-inside space-y-1">
          {meta.package.high_level_process.map((step: string) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      <h2 className="text-sm font-medium text-gray-900 mb-2">Service sequence</h2>
      <div className="overflow-x-auto border border-gray-200 rounded-lg mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Parallel</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2 text-gray-500">{m.sequence_group}</td>
                <td className="px-3 py-2">{m.service_playbook?.service?.name}</td>
                <td className="px-3 py-2">{m.parallel ? "yes" : "no"}</td>
                <td className="px-3 py-2">
                  {m.service_playbook?.id ? (
                    <Link
                      href={`/app/playbooks/services/${m.service_playbook.id}`}
                      className="text-xs text-gray-600 underline"
                    >
                      Edit tasks
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
        <GateIcon /> Package gates
      </h2>
      {gates.length === 0 ? (
        <p className="text-sm text-gray-500">No package-level gates.</p>
      ) : (
        <ul className="space-y-2">
          {gates.map((g) => (
            <li
              key={g.id}
              className="text-sm border border-amber-100 bg-amber-50/50 rounded px-3 py-2 flex items-center gap-2"
            >
              <GateIcon />
              After “{g.after_task_template?.title}” → blocks{" "}
              {g.blocks?.service?.name}
            </li>
          ))}
        </ul>
      )}
    </Workspace>
  );
}
