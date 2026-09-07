"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { isFounder } from "@/lib/rbac";
import { createSow } from "@/app/actions/sow";
import { lookupOpenLeadProject } from "@/app/actions/projects-commercial";
import { proposeSowFromContext } from "@/app/actions/sow-assist";
import { CATEGORY_LABELS, SOW_CATEGORY_ORDER } from "@/lib/sow/constants";
import type { SowCategory } from "@/lib/sow/types";
import { workPaths } from "@/lib/work/paths";
import { lostCompanyIdSet } from "@/lib/work/stages";

type CompanyOpt = { id: string; label: string; status: string | null };
type PackageOpt = { id: string; name: string; serviceIds: string[] };
type ServiceOpt = {
  id: string;
  name: string;
  category: SowCategory;
};
type SowOpt = { id: string; title: string; companyId: string };

type ScopeMode = "package" | "services" | "blank";

function NewSowForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [packages, setPackages] = useState<PackageOpt[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [existingSows, setExistingSows] = useState<SowOpt[]>([]);
  const [companyId, setCompanyId] = useState(search.get("company") || "");
  const [companyQuery, setCompanyQuery] = useState("");
  const [bdRecordId] = useState(search.get("bd") || "");
  const [packageId, setPackageId] = useState("");
  const [versionOfId, setVersionOfId] = useState(search.get("versionOf") || "");
  const [separateDeal, setSeparateDeal] = useState(false);
  const [openLead, setOpenLead] = useState<{ id: string; title: string } | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("package");
  const [contextText, setContextText] = useState("");
  const [showContext, setShowContext] = useState(
    search.get("from") === "context"
  );
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

      const [
        { data: companyData },
        { data: pkgData },
        { data: links },
        { data: svcData },
        { data: sowData },
        { data: bdStages },
      ] = await Promise.all([
        supabase
          .from("crm_customers")
          .select("id, name, company, status")
          .eq("record_kind", "company")
          .order("company"),
        supabase.from("pm_packages").select("id, name, sort_order").order("sort_order"),
        supabase.from("pm_package_services").select("package_id, service_id"),
        supabase
          .from("pm_services")
          .select("id, name, category, sort_order")
          .order("sort_order"),
        supabase
          .from("sows")
          .select("id, title, company_id")
          .order("updated_at", { ascending: false })
          .limit(200),
        supabase
          .from("bd_records")
          .select("company_id, stage")
          .not("company_id", "is", null)
          .limit(1000),
      ]);

      const byPkg = new Map<string, string[]>();
      for (const l of links ?? []) {
        const list = byPkg.get(l.package_id) ?? [];
        list.push(l.service_id);
        byPkg.set(l.package_id, list);
      }

      const lostIds = lostCompanyIdSet(bdStages ?? []);
      const mapped = (companyData ?? [])
        .filter((c) => !lostIds.has(c.id))
        .map((c) => ({
          id: c.id,
          label: c.company || c.name || "Untitled",
          status: c.status,
        }));
      setCompanies(mapped);
      setPackages(
        (pkgData ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          serviceIds: byPkg.get(p.id) ?? [],
        }))
      );
      setServices(
        (svcData ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category as SowCategory,
        }))
      );
      setExistingSows(
        (sowData ?? [])
          .filter((s): s is typeof s & { company_id: string } => Boolean(s.company_id))
          .map((s) => ({
            id: s.id,
            title: s.title,
            companyId: s.company_id,
          }))
      );
      if (pkgData?.[0]) setPackageId(pkgData[0].id);
      const versionOf = search.get("versionOf");
      if (versionOf) {
        const match = (sowData ?? []).find((s) => s.id === versionOf);
        if (match?.company_id) setCompanyId(match.company_id);
      }
      setLoading(false);
    }
    void load();
  }, []);

  useEffect(() => {
    if (!companyId) {
      setOpenLead(null);
      return;
    }
    void lookupOpenLeadProject(companyId).then((res) => {
      setOpenLead(res.ok ? res.project : null);
      setSeparateDeal(false);
    });
  }, [companyId]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.status || "").toLowerCase().includes(q)
    );
  }, [companies, companyQuery]);

  const servicesByCategory = useMemo(() => {
    const groups: { category: SowCategory; items: ServiceOpt[] }[] = [];
    for (const cat of SOW_CATEGORY_ORDER) {
      const items = services.filter((s) => s.category === cat);
      if (items.length) groups.push({ category: cat, items });
    }
    const leftover = services.filter(
      (s) => !SOW_CATEGORY_ORDER.includes(s.category)
    );
    if (leftover.length) {
      groups.push({ category: "custom", items: leftover });
    }
    return groups;
  }, [services]);

  function toggleService(id: string) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function submit() {
    setError(null);
    if (!companyId) {
      setError("Pick a company");
      return;
    }
    if (scopeMode === "package" && !packageId) {
      setError("Pick a package");
      return;
    }
    if (scopeMode === "services" && selectedServices.length === 0) {
      setError("Select at least one service");
      return;
    }
    startTransition(async () => {
      const res = await createSow({
        companyId,
        title: title.trim() || undefined,
        packageId: scopeMode === "package" ? packageId || null : null,
        serviceIds:
          scopeMode === "services"
            ? selectedServices
            : scopeMode === "blank"
              ? []
              : undefined,
        bdRecordId: bdRecordId || null,
        contextText: contextText.trim() || undefined,
        versionOfId: versionOfId || null,
        separateDeal,
      });
      if (!res.ok || !res.sowId) {
        setError(res.error || "Failed to create SOW");
        return;
      }
      if (contextText.trim()) {
        await proposeSowFromContext({ sowId: res.sowId });
      }
      router.push(
        res.projectId
          ? `/app/projects/${res.projectId}/sow`
          : workPaths.sowId(res.sowId)
      );
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
          Proposal Builder · SOW path
        </p>
        <h1 className="text-2xl font-semibold text-gray-950">New Scope of Work</h1>
        <p className="mt-1 text-sm text-gray-600">
          Company, then either one package or the services you want in scope.
          {bdRecordId && (
            <span className="block mt-1 text-xs text-gray-500">
              Will link to BD record {bdRecordId.slice(0, 8)}…
            </span>
          )}
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-gray-600">Company</span>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Search companies…"
          value={companyQuery}
          onChange={(e) => setCompanyQuery(e.target.value)}
        />
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">Select…</option>
          {filteredCompanies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.status ? ` · ${c.status}` : ""}
            </option>
          ))}
        </select>
      </div>

      {openLead && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
          <p className="text-sm text-amber-950">
            This company already has an open Lead project:{" "}
            <span className="font-semibold">{openLead.title}</span>
          </p>
          <label className="flex items-center gap-2 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={separateDeal}
              onChange={(e) => setSeparateDeal(e.target.checked)}
            />
            This is a separate deal (do not attach to that project)
          </label>
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-gray-600">
          Later version of (optional)
        </span>
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          value={versionOfId}
          onChange={(e) => {
            const id = e.target.value;
            setVersionOfId(id);
            const match = existingSows.find((s) => s.id === id);
            if (match) setCompanyId(match.companyId);
          }}
        >
          <option value="">Standalone SOW (version 1)</option>
          {existingSows
            .filter((s) => !companyId || s.companyId === companyId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
        </select>
        <p className="text-[11px] text-gray-500">
          Use this when you already sent a SOW and need a v2 for the same client.
          The original share link stays live.
        </p>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-gray-600">
          Title (optional)
        </span>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Defaults to Scope of Work — {company}"
        />
      </label>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-600">What’s in this SOW</p>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {(
            [
              { id: "package", label: "One package" },
              { id: "services", label: "Pick services" },
              { id: "blank", label: "Blank" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScopeMode(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium ${
                scopeMode === opt.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {scopeMode === "package" && (
          <div className="grid gap-2">
            {packages.map((p) => {
              const on = packageId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPackageId(p.id)}
                  className={`text-left rounded-xl border px-4 py-3 ${
                    on
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p
                    className={`text-xs mt-0.5 ${on ? "text-white/70" : "text-gray-500"}`}
                  >
                    {p.serviceIds.length} service
                    {p.serviceIds.length === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {scopeMode === "services" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Multi-select. {selectedServices.length} selected.
            </p>
            {servicesByCategory.map((group) => (
              <div key={group.category} className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  {CATEGORY_LABELS[group.category] || group.category}
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {group.items.map((s) => {
                    const on = selectedServices.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        className={`text-left rounded-lg border px-3 py-2 text-sm ${
                          on
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {scopeMode === "blank" && (
          <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 px-4 py-3">
            Empty SOW — add catalog services in the builder after create.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          className="text-xs font-medium text-blue-700"
          onClick={() => setShowContext((v) => !v)}
        >
          {showContext ? "Hide discovery notes" : "Add discovery notes (optional)"}
        </button>
        {showContext && (
          <textarea
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[120px]"
            placeholder="Paste call notes, email, or transcript — we’ll draft suggestions after create."
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create SOW"}
        </button>
        <button
          type="button"
          onClick={() => router.push(workPaths.sow)}
          className="rounded-lg border border-gray-200 text-sm font-medium px-4 py-2.5 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function NewSowPage() {
  return (
    <Workspace wide>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        }
      >
        <NewSowForm />
      </Suspense>
    </Workspace>
  );
}
