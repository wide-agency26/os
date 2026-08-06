"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";

export default function PmSettingsPage() {
  const [form, setForm] = useState({
    fragmentation_base_projects: 2,
    fragmentation_penalty_pct: 10,
    stale_after_days: 7,
  });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");

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

  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">PM settings</h1>
      <div className="max-w-md space-y-4 text-sm">
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
      </div>
    </Workspace>
  );
}
