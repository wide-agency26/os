"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { isFounder } from "@/lib/rbac";
import { createSow } from "@/app/actions/sow";

type CompanyOpt = { id: string; label: string; status: string | null };
type PackageOpt = { id: string; name: string; serviceCount: number };

function NewSowForm() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [packages, setPackages] = useState<PackageOpt[]>([]);
  const [companyId, setCompanyId] = useState(search.get("company") || "");
  const [bdRecordId] = useState(search.get("bd") || "");
  const [packageId, setPackageId] = useState("");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"package" | "blank">("package");
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

      const [{ data: companyData }, { data: pkgData }, { data: links }] =
        await Promise.all([
          supabase
            .from("crm_customers")
            .select("id, name, company, status")
            .eq("record_kind", "company")
            .order("company"),
          supabase.from("pm_packages").select("id, name, sort_order").order("sort_order"),
          supabase.from("pm_package_services").select("package_id, service_id"),
        ]);

      const counts = new Map<string, number>();
      for (const l of links ?? []) {
        counts.set(l.package_id, (counts.get(l.package_id) ?? 0) + 1);
      }

      const mapped = (companyData ?? []).map((c) => ({
        id: c.id,
        label: c.company || c.name || "Untitled",
        status: c.status,
      }));
      setCompanies(mapped);
      setPackages(
        (pkgData ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          serviceCount: counts.get(p.id) ?? 0,
        }))
      );
      if (!companyId && mapped[0]) setCompanyId(mapped[0].id);
      if (pkgData?.[0]) setPackageId(pkgData[0].id);
      setLoading(false);
    }
    void load();
  }, []);

  function submit() {
    setError(null);
    if (!companyId) {
      setError("Pick a company");
      return;
    }
    startTransition(async () => {
      const res = await createSow({
        companyId,
        title: title.trim() || undefined,
        packageId: mode === "package" ? packageId || null : null,
        serviceIds: mode === "blank" ? [] : undefined,
        bdRecordId: bdRecordId || null,
      });
      if (!res.ok || !res.sowId) {
        setError(res.error || "Failed to create SOW");
        return;
      }
      router.push(`/app/bd/lms/${res.sowId}`);
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
    <div className="max-w-xl space-y-6 py-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Proposal Builder · SOW path
        </p>
        <h1 className="text-2xl font-semibold text-gray-950">New Scope of Work</h1>
        <p className="mt-1 text-sm text-gray-600">
          Assign to a company first. Link a project later once the deal is won.
          {bdRecordId && (
            <span className="block mt-1 text-xs text-gray-500">
              Will link to BD record {bdRecordId.slice(0, 8)}…
            </span>
          )}
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-gray-600">Company</span>
        <select
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">Select…</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
              {c.status ? ` · ${c.status}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-gray-600">Title (optional)</span>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Defaults to Scope of Work — {company}"
        />
      </label>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-600">Starting point</p>
        <div className="grid gap-2">
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={mode === "package"}
              onChange={() => setMode("package")}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">From package</p>
              <p className="text-xs text-gray-500">
                Pre-populates services from MVB / Startup Launch / Growth /
                Full-Service.
              </p>
              {mode === "package" && (
                <select
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={packageId}
                  onChange={(e) => setPackageId(e.target.value)}
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.serviceCount} services)
                    </option>
                  ))}
                </select>
              )}
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              checked={mode === "blank"}
              onChange={() => setMode("blank")}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">Blank</p>
              <p className="text-xs text-gray-500">
                Empty SOW — add catalog services or manual sections in the
                builder.
              </p>
            </div>
          </label>
        </div>
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
          onClick={() => router.push("/app/bd/lms")}
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
    <Workspace>
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
