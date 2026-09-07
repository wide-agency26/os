"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  getGlobalTaskPolicyAction,
  saveGlobalTaskPolicyAction,
} from "@/app/actions/pm";
import {
  DEFAULT_TASK_POLICY,
  type GlobalTaskPolicy,
} from "@/lib/pm/task-policy";

export default function PmSettingsPage() {
  const [form, setForm] = useState({
    fragmentation_base_projects: 2,
    fragmentation_penalty_pct: 10,
    stale_after_days: 7,
  });
  const [policy, setPolicy] = useState<GlobalTaskPolicy>({ ...DEFAULT_TASK_POLICY });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [policyMsg, setPolicyMsg] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("pm_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (data) {
        setForm({
          fragmentation_base_projects: data.fragmentation_base_projects,
          fragmentation_penalty_pct: Number(data.fragmentation_penalty_pct),
          stale_after_days: data.stale_after_days,
        });
      }
      const res = await getGlobalTaskPolicyAction();
      if (res.ok) setPolicy(res.policy);
    }
    void load();
  }, []);

  const save = () => {
    setMsg("");
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await (supabase as any)
        .from("pm_settings")
        .upsert({ id: 1, ...form, updated_at: new Date().toISOString() });
      setMsg(error ? error.message : "Saved.");
    });
  };

  const savePolicy = () => {
    setPolicyMsg("");
    startTransition(async () => {
      const res = await saveGlobalTaskPolicyAction(policy);
      if (!res.ok) {
        setPolicyMsg(res.error);
        return;
      }
      setPolicy(res.policy);
      setPolicyMsg("Task policy saved.");
    });
  };

  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">PM settings</h1>
      <div className="max-w-lg space-y-8 text-sm">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Capacity & stale</h2>
          <label className="block">
            <span className="text-gray-600">Stale after (days)</span>
            <input
              type="number"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5"
              value={form.stale_after_days}
              onChange={(e) =>
                setForm({ ...form, stale_after_days: Number(e.target.value) })
              }
            />
          </label>
          <label className="block">
            <span className="text-gray-600">Fragmentation base (# projects)</span>
            <input
              type="number"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5"
              value={form.fragmentation_base_projects}
              onChange={(e) =>
                setForm({
                  ...form,
                  fragmentation_base_projects: Number(e.target.value),
                })
              }
            />
          </label>
          <label className="block">
            <span className="text-gray-600">Penalty % per extra project</span>
            <input
              type="number"
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5"
              value={form.fragmentation_penalty_pct}
              onChange={(e) =>
                setForm({
                  ...form,
                  fragmentation_penalty_pct: Number(e.target.value),
                })
              }
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="bg-gray-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          {msg ? <p className="text-xs text-gray-500">{msg}</p> : null}
        </section>

        <section className="space-y-4 border-t border-gray-200 pt-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Global task retitle policy
            </h2>
            <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">
              Used by the agency MCP bot and the Tasks UI. Projects can override
              with locked / default / free on the project tasks page.
            </p>
          </div>
          <label className="block">
            <span className="text-gray-600">Retitle mode</span>
            <select
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5"
              value={policy.retitle_mode}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  retitle_mode: e.target.value as GlobalTaskPolicy["retitle_mode"],
                })
              }
            >
              <option value="default">Default (restricted)</option>
              <option value="locked">Locked (never retitle)</option>
              <option value="free">Free (unrestricted)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-gray-600">Max retitles per task</span>
            <input
              type="number"
              min={0}
              max={20}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5"
              value={policy.max_retitles}
              onChange={(e) =>
                setPolicy({ ...policy, max_retitles: Number(e.target.value) })
              }
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.allow_polish}
              onChange={(e) =>
                setPolicy({ ...policy, allow_polish: e.target.checked })
              }
            />
            <span className="text-gray-600">Allow wording-polish retitles</span>
          </label>
          <label className="block">
            <span className="text-gray-600">Rule text (shown to bot / staff)</span>
            <textarea
              rows={3}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5"
              value={policy.rule}
              onChange={(e) => setPolicy({ ...policy, rule: e.target.value })}
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={savePolicy}
            className="bg-gray-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save task policy"}
          </button>
          {policyMsg ? <p className="text-xs text-gray-500">{policyMsg}</p> : null}
        </section>
      </div>
    </Workspace>
  );
}
