"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type ProjectOption = {
  id: string;
  title: string | null;
  status?: string | null;
};

/** Lightweight project picker for HR compensation / overhead attribution. */
export function ProjectLinkSelect({
  value,
  onChange,
  required,
  hint,
  className,
}: {
  value: string;
  onChange: (projectId: string) => void;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await (supabase as any)
      .from("projects")
      .select("id, title, status")
      .order("title", { ascending: true });
    if (error) {
      console.error(error);
      setOptions([]);
    } else {
      setOptions((data || []) as ProjectOption[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <label className={`block ${className || ""}`}>
      <span className="text-[12px] font-semibold text-gray-700">
        Project{required ? " *" : " (optional)"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px] bg-white"
      >
        <option value="">
          {loading ? "Loading projects…" : "— Not linked to a project —"}
        </option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title || "Untitled"}
            {p.status ? ` (${p.status})` : ""}
          </option>
        ))}
      </select>
      {hint ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </label>
  );
}
