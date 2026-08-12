"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { isFounder } from "@/lib/rbac";
import { createBdSlideDeck } from "@/app/actions/bd";

type ServiceOpt = { id: string; name: string; category: string };
type BdOpt = { id: string; label: string };

function NewSlideDeckForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [records, setRecords] = useState<BdOpt[]>([]);
  const [bdRecordId, setBdRecordId] = useState(search.get("bd") || "");
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || !isFounder(profile.role)) {
        setDenied(true);
        setLoading(false);
        return;
      }

      const [{ data: svc }, { data: recs }] = await Promise.all([
        supabase
          .from("pm_services")
          .select("id, name, category, sort_order")
          .order("sort_order"),
        supabase
          .from("bd_records")
          .select("id, name, company_name, stage")
          .not("stage", "eq", "archived")
          .order("updated_at", { ascending: false })
          .limit(100),
      ]);

      setServices(
        (svc ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
        }))
      );
      setRecords(
        (recs ?? []).map((r) => ({
          id: r.id,
          label: `${r.company_name} · ${r.name}`,
        }))
      );
      setLoading(false);
    }
    void load();
  }, []);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function submit() {
    setError(null);
    if (selected.length === 0) {
      setError("Select at least one service");
      return;
    }
    startTransition(async () => {
      const res = await createBdSlideDeck({
        bdRecordId: bdRecordId || null,
        serviceIds: selected,
        title: title.trim() || undefined,
      });
      if (!res.ok || !res.deckId) {
        setError(res.error || "Failed to create deck");
        return;
      }
      router.push(`/app/bd/proposal/slides/${res.deckId}`);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (denied) {
    return <p className="text-red-600 font-medium">Access denied.</p>;
  }

  return (
    <div className="max-w-2xl space-y-6 py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Proposal Builder · Slide path
        </p>
        <h1 className="text-2xl font-semibold text-gray-950">New slide deck</h1>
        <p className="mt-1 text-sm text-gray-600">
          Services seed templated slides. Discovery notes on the BD record are
          pulled in automatically when linked.
        </p>
      </div>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Link BD record (recommended)
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={bdRecordId}
          onChange={(e) => setBdRecordId(e.target.value)}
        >
          <option value="">— none —</option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Title (optional)
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Proposal deck — …"
        />
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-700">Services</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {services.map((s) => {
            const on = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={`text-left rounded-lg border px-3 py-2 text-sm ${
                  on
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-800"
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span
                  className={`block text-[10px] uppercase tracking-wide ${
                    on ? "text-white/70" : "text-gray-500"
                  }`}
                >
                  {s.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
        >
          {pending && <Loader2 size={16} className="animate-spin" />}
          Generate deck
        </button>
        <Link
          href="/app/bd/proposal"
          className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

export default function NewSlideDeckPage() {
  return (
    <Workspace wide>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        }
      >
        <NewSlideDeckForm />
      </Suspense>
    </Workspace>
  );
}
