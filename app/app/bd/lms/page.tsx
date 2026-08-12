"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { isFounder } from "@/lib/rbac";
import { SOW_STATUS_LABELS } from "@/lib/sow/constants";
import { deleteSow } from "@/app/actions/sow";

type CompanyRow = {
  id: string;
  label: string;
  status: string | null;
  sowCount: number;
};

type SowRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  company_id: string | null;
  companyLabel?: string;
  companyStatus?: string | null;
};

function BdLmsPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const bdRecordId = search.get("bd") || "";
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [sows, setSows] = useState<SowRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"engaged" | "all">("engaged");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

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

    let companyQuery = supabase
      .from("crm_customers")
      .select("id, name, company, status, record_kind")
      .eq("record_kind", "company")
      .order("company");

    if (statusFilter === "engaged") {
      companyQuery = companyQuery.in("status", ["Prospect", "Lead", "Client"]);
    }

    const [{ data: companyData }, { data: sowData }] = await Promise.all([
      companyQuery.limit(200),
      supabase
        .from("sows")
        .select(
          `
          id,
          title,
          status,
          updated_at,
          company_id,
          crm_customers!company_id (
            company,
            name,
            status
          )
        `
        )
        .order("updated_at", { ascending: false })
        .limit(80),
    ]);

    const sowCounts = new Map<string, number>();
    for (const s of sowData ?? []) {
      if (s.company_id) {
        sowCounts.set(s.company_id, (sowCounts.get(s.company_id) ?? 0) + 1);
      }
    }

    setCompanies(
      (companyData ?? []).map((c) => ({
        id: c.id,
        label: c.company || c.name || "Untitled company",
        status: c.status,
        sowCount: sowCounts.get(c.id) ?? 0,
      }))
    );

    setSows(
      (sowData ?? []).map((s) => {
        const coRaw = s.crm_customers as
          | { company?: string; name?: string; status?: string }
          | { company?: string; name?: string; status?: string }[]
          | null;
        const co = Array.isArray(coRaw) ? coRaw[0] : coRaw;
        return {
          id: s.id,
          title: s.title,
          status: s.status,
          updated_at: s.updated_at,
          company_id: s.company_id,
          companyLabel: co?.company || co?.name || undefined,
          companyStatus: co?.status ?? null,
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [statusFilter]);

  function handleDelete(sowId: string, title: string) {
    if (!window.confirm(`Delete SOW “${title}”? This cannot be undone.`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await deleteSow(sowId);
      if (!res.ok) {
        setMessage(res.error || "Delete failed");
        return;
      }
      setMessage("SOW deleted");
      setLoading(true);
      await load();
    });
  }

  if (loading) {
    return (
      <Workspace wide>
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Workspace>
    );
  }

  if (denied) {
    return (
      <Workspace>
        <p className="text-red-600 font-medium">Access denied.</p>
      </Workspace>
    );
  }

  return (
    <Workspace wide>
      <div className="space-y-8 py-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Proposal Builder · SOW path
            </p>
            <h1 className="text-2xl font-semibold text-gray-950 tracking-tight">
              SOW Builder
            </h1>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl">
              Scopes attach to a company (prospect / lead / client). After
              agreement, the deal becomes a project — every project will carry
              its SOW forward.{" "}
              <Link href="/app/bd/proposal" className="text-blue-700 font-medium">
                Back to Proposal hub
              </Link>
            </p>
          </div>
          <Link
            href={
              bdRecordId
                ? `/app/bd/lms/new?bd=${encodeURIComponent(bdRecordId)}`
                : "/app/bd/lms/new"
            }
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-blue-700"
          >
            <Plus size={16} /> New SOW
          </Link>
        </div>

        {message && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Companies</h2>
            <button
              type="button"
              className="text-xs text-blue-600 font-medium"
              onClick={() =>
                setStatusFilter((v) => (v === "engaged" ? "all" : "engaged"))
              }
            >
              {statusFilter === "engaged"
                ? "Show all companies"
                : "Show Prospect / Lead / Client only"}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Company</th>
                  <th className="px-4 py-2.5 font-semibold">CRM status</th>
                  <th className="px-4 py-2.5 font-semibold">SOWs</th>
                  <th className="px-4 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No companies found. Create a company in CRM first.
                    </td>
                  </tr>
                )}
                {companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.label}</td>
                    <td className="px-4 py-3 text-gray-600">{c.status || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{c.sowCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                        onClick={() =>
                          router.push(`/app/bd/lms/new?company=${c.id}`)
                        }
                      >
                        Create SOW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Recent SOWs</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sows.length === 0 && (
              <p className="text-sm text-gray-500 col-span-full">
                No SOWs yet. Create one for a company above.
              </p>
            )}
            {sows.map((sow) => (
              <div
                key={sow.id}
                className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col gap-3"
              >
                <Link href={`/app/bd/lms/${sow.id}`} className="flex items-start gap-3 min-w-0">
                  <div className="rounded-lg bg-blue-50 text-blue-700 p-2 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{sow.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {sow.companyLabel || "No company"}
                      {sow.companyStatus ? ` · ${sow.companyStatus}` : ""}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      {SOW_STATUS_LABELS[sow.status] || sow.status}
                    </p>
                  </div>
                </Link>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(sow.id, sow.title)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Workspace>
  );
}

export default function BdLmsPage() {
  return (
    <Suspense
      fallback={
        <Workspace wide>
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        </Workspace>
      }
    >
      <BdLmsPageInner />
    </Suspense>
  );
}
