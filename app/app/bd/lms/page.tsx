"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Copy,
  ExternalLink,
  FileText,
  GitBranch,
  Layers,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { isFounder } from "@/lib/rbac";
import {
  SOW_DECISION_BADGE,
  computeSowValueFromRows,
  formatSowMoney,
  resolveSowListDecision,
  resolveSowVat,
  type SowListDecision,
} from "@/lib/sow/constants";
import { isFrozenSowSlug } from "@/lib/sow/frozen";
import { deleteSow, duplicateSow, linkSowAsVersion, updateSowMeta } from "@/app/actions/sow";
import type { SowVat } from "@/lib/sow/types";
import { workPaths } from "@/lib/work/paths";
import { lostCompanyIdSet } from "@/lib/work/stages";

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
  public_slug: string | null;
  currency: string;
  vat: SowVat;
  value: number;
  decision: SowListDecision;
  decisionLabel: string;
  locked: boolean;
  version_root_id: string | null;
  version_number: number;
  project_id: string | null;
  project_stage: string | null;
};

const CRM_STATUSES = ["Prospect", "Lead", "Client"] as const;
type CompanyFilter = "all" | "Prospect" | "Lead" | "Client";

const STATUS_RANK: Record<string, number> = {
  Client: 0,
  Lead: 1,
  Prospect: 2,
};

function absoluteShare(path: string) {
  if (path.startsWith("http")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function BdLmsPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const bdRecordId = search.get("bd") || "";
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [sows, setSows] = useState<SowRow[]>([]);
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>("all");
  const [companyQuery, setCompanyQuery] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
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

    const [{ data: companyData }, { data: sowData }, { data: sowCountRows }] =
      await Promise.all([
        supabase
          .from("crm_customers")
          .select("id, name, company, status, record_kind")
          .eq("record_kind", "company")
          .order("company")
          .limit(400),
        supabase
          .from("sows")
          .select(
            `
          id,
          title,
          status,
          updated_at,
          company_id,
          public_slug,
          currency,
          vat,
          version_root_id,
          version_number,
          project_id,
          projects!project_id (
            stage
          ),
          crm_customers!company_id (
            company,
            name,
            status
          )
        `
          )
          .order("updated_at", { ascending: false })
          .limit(300),
        supabase.from("sows").select("company_id").limit(1000),
      ]);

    const sowIds = (sowData ?? []).map((s) => s.id);
    const [{ data: groups }, { data: items }, { data: bdRecs }] =
      sowIds.length > 0
        ? await Promise.all([
            supabase
              .from("sow_cost_groups")
              .select("sow_id, price")
              .in("sow_id", sowIds),
            supabase
              .from("sow_line_items")
              .select("sow_id, price, cost_group_id")
              .in("sow_id", sowIds),
            supabase
              .from("bd_records")
              .select("id, proposal")
              .not("proposal", "is", null)
              .limit(400),
          ])
        : [
            { data: [] as { sow_id: string; price: number | null }[] },
            {
              data: [] as {
                sow_id: string;
                price: number | null;
                cost_group_id: string | null;
              }[],
            },
            { data: [] as { id: string; proposal: unknown }[] },
          ];

    const { data: bdStages } = await supabase
      .from("bd_records")
      .select("company_id, stage")
      .not("company_id", "is", null)
      .limit(1000);
    const lostIds = lostCompanyIdSet(bdStages ?? []);

    const proposalBySow = new Map<string, string | null>();
    for (const rec of bdRecs ?? []) {
      const p = rec.proposal as
        | { type?: string; linked_id?: string; status?: string }
        | null;
      if (!p || p.type !== "sow" || !p.linked_id) continue;
      proposalBySow.set(p.linked_id, p.status ?? null);
    }

    const groupsBySow = new Map<string, { price: number | null }[]>();
    for (const g of groups ?? []) {
      const list = groupsBySow.get(g.sow_id) ?? [];
      list.push({ price: g.price });
      groupsBySow.set(g.sow_id, list);
    }
    const itemsBySow = new Map<
      string,
      { price: number | null; cost_group_id: string | null }[]
    >();
    for (const i of items ?? []) {
      const list = itemsBySow.get(i.sow_id) ?? [];
      list.push({ price: i.price, cost_group_id: i.cost_group_id });
      itemsBySow.set(i.sow_id, list);
    }

    const sowCounts = new Map<string, number>();
    for (const s of sowCountRows ?? []) {
      if (s.company_id) {
        sowCounts.set(s.company_id, (sowCounts.get(s.company_id) ?? 0) + 1);
      }
    }

    setCompanies(
      (companyData ?? [])
        .filter((c) => !lostIds.has(c.id))
        .map((c) => ({
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
        const vat = resolveSowVat(
          (s as { vat?: Partial<SowVat> | null }).vat || null
        );
        const value = computeSowValueFromRows({
          groups: groupsBySow.get(s.id) ?? [],
          items: itemsBySow.get(s.id) ?? [],
        });
        const decision = resolveSowListDecision(
          s.status,
          proposalBySow.get(s.id) ?? null
        );
        const slug = (s as { public_slug?: string | null }).public_slug ?? null;
        return {
          id: s.id,
          title: s.title,
          status: s.status,
          updated_at: s.updated_at,
          company_id: s.company_id,
          companyLabel: co?.company || co?.name || undefined,
          companyStatus: co?.status ?? null,
          public_slug: slug,
          currency: s.currency || "EUR",
          vat,
          value,
          decision: decision.id,
          decisionLabel: decision.label,
          locked: isFrozenSowSlug(slug),
          version_root_id:
            (s as { version_root_id?: string | null }).version_root_id ?? null,
          version_number: (s as { version_number?: number }).version_number ?? 1,
          project_id: (s as { project_id?: string | null }).project_id ?? null,
          project_stage: (() => {
            const p = (s as { projects?: { stage?: string } | { stage?: string }[] }).projects;
            const row = Array.isArray(p) ? p[0] : p;
            return row?.stage ?? null;
          })(),
        };
      })
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return companies
      .filter((c) => {
        if (companyFilter === "all") {
          return CRM_STATUSES.includes(
            (c.status || "") as (typeof CRM_STATUSES)[number]
          );
        }
        return c.status === companyFilter;
      })
      .filter((c) => (q ? c.label.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const ra = STATUS_RANK[a.status || ""] ?? 9;
        const rb = STATUS_RANK[b.status || ""] ?? 9;
        if (ra !== rb) return ra - rb;
        if (b.sowCount !== a.sowCount) return b.sowCount - a.sowCount;
        return a.label.localeCompare(b.label);
      });
  }, [companies, companyFilter, companyQuery]);

  const families = useMemo(() => {
    const map = new Map<string, SowRow[]>();
    for (const s of sows) {
      const key = s.version_root_id || s.id;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    const grouped = [...map.values()].map((list) =>
      [...list].sort((a, b) => b.version_number - a.version_number)
    );
    grouped.sort((a, b) => {
      const ta = Math.max(...a.map((s) => new Date(s.updated_at).getTime()));
      const tb = Math.max(...b.map((s) => new Date(s.updated_at).getTime()));
      return tb - ta;
    });
    return grouped;
  }, [sows]);

  function handleDuplicate(sowId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await duplicateSow(sowId);
      if (!res.ok || !res.sowId) {
        setMessage(res.error || "Duplicate failed");
        return;
      }
      router.push(workPaths.sowId(res.sowId));
    });
  }

  function handleNewVersion(sowId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await duplicateSow(sowId, { asVersion: true });
      if (!res.ok || !res.sowId) {
        setMessage(res.error || "Could not create version");
        return;
      }
      router.push(workPaths.sowId(res.sowId));
    });
  }

  function handleLinkVersion(sowId: string, ofSowId: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await linkSowAsVersion({ sowId, ofSowId });
      if (!res.ok) {
        setMessage(res.error || "Could not link version");
        return;
      }
      setLinkingId(null);
      setMessage("Linked as a later version");
      await load();
    });
  }

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
      setSows((prev) => prev.filter((s) => s.id !== sowId));
    });
  }

  function handleRename(sowId: string, title: string) {
    const next = title.trim();
    if (!next) return;
    const current = sows.find((s) => s.id === sowId);
    if (!current || current.title === next) return;
    setSows((prev) =>
      prev.map((s) => (s.id === sowId ? { ...s, title: next } : s))
    );
    startTransition(async () => {
      const res = await updateSowMeta({ sowId, title: next });
      if (!res.ok) {
        setMessage(res.error || "Rename failed");
        await load();
      }
    });
  }

  async function handleCopyUrl(slug: string) {
    const url = absoluteShare(`/s/${slug}`);
    try {
      await navigator.clipboard.writeText(url);
      setMessage(`Copied ${url}`);
    } catch {
      setMessage(url);
    }
  }

  const newHref = bdRecordId
    ? `${workPaths.sowNew}?bd=${encodeURIComponent(bdRecordId)}`
    : workPaths.sowNew;

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
      <div className="space-y-10 py-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Proposal Builder · SOW path
            </p>
            <h1 className="text-2xl font-semibold text-gray-950 tracking-tight">
              SOW Builder
            </h1>
            <p className="mt-1 text-sm text-gray-600 max-w-2xl">
              Existing scopes first. Rename here and it follows the document,
              the public page, and the linked BD proposal.{" "}
              <Link href={workPaths.propose} className="text-blue-700 font-medium">
                Back to Proposal hub
              </Link>
            </p>
          </div>
          <Link
            href={newHref}
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
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Scopes of work
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {sows.length} document{sows.length === 1 ? "" : "s"}
                {families.length !== sows.length
                  ? ` · ${families.length} version families`
                  : ""}{" "}
                · newest first
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sows.length === 0 && (
              <p className="text-sm text-gray-500 col-span-full rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center">
                No SOWs yet. Create one from a company below.
              </p>
            )}
            {families.map((family) => {
              const latest = family[0];
              const earlier = family.slice(1);
              const sentNets = family
                .filter(
                  (s) =>
                    (s.status === "published" || s.status === "accepted") &&
                    s.value > 0
                )
                .map((s) => s.value);
              const identifiedNet =
                sentNets.length > 0 ? Math.min(...sentNets) : latest.value;
              return (
                <div
                  key={latest.version_root_id || latest.id}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-gray-300 hover:shadow-sm transition-all flex flex-col"
                >
                  <SowCard
                    sow={latest}
                    familySize={family.length}
                    identifiedNet={identifiedNet}
                    pending={pending}
                    linking={linkingId === latest.id}
                    linkTargets={sows.filter(
                      (s) =>
                        s.id !== latest.id &&
                        s.company_id === latest.company_id &&
                        (s.version_root_id || s.id) !==
                          (latest.version_root_id || latest.id)
                    )}
                    onRename={handleRename}
                    onCopyUrl={handleCopyUrl}
                    onDuplicate={handleDuplicate}
                    onNewVersion={handleNewVersion}
                    onStartLink={() =>
                      setLinkingId((id) => (id === latest.id ? null : latest.id))
                    }
                    onLinkVersion={(ofId) => handleLinkVersion(latest.id, ofId)}
                    onDelete={handleDelete}
                  />
                  {earlier.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        Earlier versions
                      </p>
                      {earlier.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="font-bold text-gray-500 shrink-0">
                            v{v.version_number}
                          </span>
                          <Link
                            href={workPaths.sowId(v.id)}
                            className="truncate text-gray-700 hover:text-gray-950 font-medium"
                          >
                            {v.title}
                          </Link>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${SOW_DECISION_BADGE[v.decision].className}`}
                          >
                            {v.decisionLabel}
                          </span>
                          {v.value > 0 && (
                            <span className="shrink-0 text-gray-500 tabular-nums">
                              {formatSowMoney(v.value, v.currency)}
                            </span>
                          )}
                          {v.public_slug && (
                            <button
                              type="button"
                              className="shrink-0 text-gray-500 hover:text-gray-900"
                              onClick={() => handleCopyUrl(v.public_slug!)}
                            >
                              Copy URL
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Companies</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Start a new SOW from a CRM company
              </p>
            </div>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="w-56 rounded-lg border border-gray-200 pl-8 pr-3 py-1.5 text-sm"
                placeholder="Search companies…"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
            {(
              [
                { id: "all", label: "All" },
                { id: "Prospect", label: "Prospect" },
                { id: "Lead", label: "Lead" },
                { id: "Client", label: "Client" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCompanyFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium ${
                  companyFilter === opt.id
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
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
                {filteredCompanies.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No companies in this filter.
                    </td>
                  </tr>
                )}
                {filteredCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.label}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          c.status === "Client"
                            ? "bg-emerald-50 text-emerald-800"
                            : c.status === "Lead"
                              ? "bg-blue-50 text-blue-800"
                              : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {c.status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.sowCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                        onClick={() =>
                          router.push(
                            `${workPaths.sowNew}?company=${c.id}${
                              bdRecordId
                                ? `&bd=${encodeURIComponent(bdRecordId)}`
                                : ""
                            }`
                          )
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
      </div>
    </Workspace>
  );
}

function SowCard({
  sow,
  familySize,
  identifiedNet,
  pending,
  linking,
  linkTargets,
  onRename,
  onCopyUrl,
  onDuplicate,
  onNewVersion,
  onStartLink,
  onLinkVersion,
  onDelete,
}: {
  sow: SowRow;
  familySize: number;
  identifiedNet: number;
  pending: boolean;
  linking: boolean;
  linkTargets: SowRow[];
  onRename: (id: string, title: string) => void;
  onCopyUrl: (slug: string) => void;
  onDuplicate: (id: string) => void;
  onNewVersion: (id: string) => void;
  onStartLink: () => void;
  onLinkVersion: (ofSowId: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const vatAmount = sow.vat.enabled ? sow.value * (sow.vat.rate / 100) : 0;
  const gross = sow.value + vatAmount;
  const badge = SOW_DECISION_BADGE[sow.decision];
  const updated = new Date(sow.updated_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="rounded-lg bg-blue-50 text-blue-700 p-2 shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 truncate">
              {sow.companyLabel || "No company"}
              {sow.companyStatus ? ` · ${sow.companyStatus}` : ""}
              {familySize > 1 || sow.version_number > 1
                ? ` · v${sow.version_number}${familySize > 1 ? ` of ${familySize}` : ""}`
                : ""}
            </p>
            <input
              className="mt-0.5 w-full text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent focus:border-blue-500 outline-none disabled:opacity-60"
              defaultValue={sow.title}
              key={sow.title}
              disabled={sow.locked || pending}
              title={sow.locked ? "This shared SOW is locked" : "Rename"}
              onBlur={(e) => onRename(sow.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
        >
          {sow.decisionLabel}
        </span>
      </div>

      <div>
        {sow.value > 0 ? (
          <>
            <p className="text-lg font-semibold text-gray-950 tabular-nums">
              {formatSowMoney(sow.value, sow.currency)}
              <span className="ml-1 text-xs font-normal text-gray-500">net</span>
            </p>
            {sow.vat.enabled && (
              <p className="text-[11px] text-gray-500">
                {formatSowMoney(gross, sow.currency)} incl. {sow.vat.rate}% VAT
              </p>
            )}
            {familySize > 1 && identifiedNet > 0 && identifiedNet !== sow.value && (
              <p className="text-[11px] text-amber-800 mt-1">
                Identified counts {formatSowMoney(identifiedNet, sow.currency)}{" "}
                (lower of {familySize} versions)
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">No value set yet</p>
        )}
        <p className="text-[11px] text-gray-400 mt-1">Updated {updated}</p>
      </div>

      {linking && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1.5">
          <p className="text-[11px] font-semibold text-amber-900">
            This is a later version of…
          </p>
          <select
            className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onLinkVersion(e.target.value);
            }}
          >
            <option value="">Select original SOW</option>
            {linkTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
                {t.version_number > 1 ? ` (v${t.version_number})` : ""}
              </option>
            ))}
          </select>
          {linkTargets.length === 0 && (
            <p className="text-[10px] text-amber-800">
              No other SOWs for this company to attach to.
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
        <Link
          href={workPaths.sowId(sow.id)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
        >
          Open <ExternalLink size={11} />
        </Link>
        {sow.project_id && (
          <Link
            href={`/app/projects/${sow.project_id}/sow`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-950"
          >
            Open project
          </Link>
        )}
        {sow.project_stage && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
            {sow.project_stage === "lead"
              ? "Identified"
              : sow.project_stage === "prospect"
                ? "Unidentified"
                : sow.status === "draft"
                  ? "Draft"
                  : "Actual"}
          </span>
        )}
        <button
          type="button"
          disabled={!sow.public_slug}
          title={
            sow.public_slug
              ? "Copy public URL"
              : "Publish the SOW to get a share link"
          }
          onClick={() => sow.public_slug && onCopyUrl(sow.public_slug)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-950 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Link2 size={12} /> Copy URL
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onNewVersion(sow.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-950 disabled:opacity-50"
          title="Copy this SOW as the next version — original share link stays unchanged"
        >
          <Layers size={12} /> New version
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onStartLink}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-950 disabled:opacity-40"
          title="Mark this existing document as a later version of another SOW"
        >
          <GitBranch size={12} /> {linking ? "Cancel" : "Link version"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDuplicate(sow.id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-950 disabled:opacity-50"
        >
          <Copy size={12} /> Duplicate
        </button>
        <button
          type="button"
          disabled={pending || sow.locked}
          onClick={() => onDelete(sow.id, sow.title)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
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
