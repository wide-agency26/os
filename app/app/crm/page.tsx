"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { ArrowDown, ArrowUp, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { workPaths } from "@/lib/work/paths";
import { loadCompanyUsersData, type CompanyMemberRow } from "@/app/actions/company-members";
import { workGroupFromBdStage, WORK_GROUP_LABELS, type WorkGroup } from "@/lib/work/stages";
import type { BdStage } from "@/lib/bd/types";
import { formatEuro } from "@/lib/accounting/types";
import {
  Button,
  EmptyState,
  PageHeader,
  Panel,
  buttonClass,
} from "@/components/frappe-ui/primitives";

type CompanyRow = {
  id: string;
  name: string;
  company: string | null;
  status: string | null;
  lead_status: string | null;
  email: string | null;
  contract_value: number | null;
  org_role: string | null;
  parent_company_id: string | null;
};

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  status: string | null;
  parent_company_id: string | null;
  archived_at?: string | null;
};

type ProjectLite = {
  client_id: string | null;
  stage: string | null;
};

type BdLite = {
  company_id: string | null;
  stage: string;
  estimate_amount: number | null;
};

type KindView = "companies" | "contacts" | "members";
type StatusFilter = "" | "Client" | "Prospect" | "Lead";
type SortKey = "company" | "status" | "chance" | "value" | "contacts";
type SortDir = "asc" | "desc";
type AddMode = "company" | "contact" | null;

type StageRatio = { prospect: number; lead: number; client: number };

function emptyRatio(): StageRatio {
  return { prospect: 0, lead: 0, client: 0 };
}

function bumpRatio(r: StageRatio, stage: string | null) {
  const s = (stage || "").toLowerCase();
  if (s === "client" || s === "signed") r.client += 1;
  else if (s === "lead") r.lead += 1;
  else if (s === "prospect") r.prospect += 1;
  else if (s === "completed") r.client += 1;
}

function ratioLabel(r: StageRatio): string {
  return `Client ${r.client} · Lead ${r.lead} · Prospect ${r.prospect}`;
}

function derivedCrmStatus(r: StageRatio, fallback: string | null): string {
  if (r.client > 0) return "Client";
  if (r.lead > 0) return "Lead";
  if (r.prospect > 0) return "Prospect";
  return fallback || "—";
}

function orgRoleBadge(role: string | null): string | null {
  if (role === "hq") return "HQ";
  if (role === "operating") return "Operating";
  return null;
}

/** Closer to a signed deal = higher chance. */
const STAGE_CHANCE: Record<string, number> = {
  client_won: 100,
  quotation: 90,
  contract: 82,
  proposal_sent: 72,
  discovery_call: 58,
  outreach: 48,
  qualified_lead: 42,
  qualifying: 28,
  prospect: 16,
  on_hold: 8,
  declined: 2,
  archived: 1,
};

function statusChance(status: string | null): number {
  if (status === "Client") return 95;
  if (status === "Lead") return 40;
  if (status === "Prospect") return 14;
  return 0;
}

function opportunityForCompany(
  company: CompanyRow,
  bds: BdLite[]
): { chance: number; label: string; value: number } {
  let bestChance = statusChance(company.status);
  let bestStage: string | null = null;
  let value = Number(company.contract_value || 0);
  for (const b of bds) {
    const c = STAGE_CHANCE[b.stage] ?? 10;
    if (c > bestChance) {
      bestChance = c;
      bestStage = b.stage;
    }
    const amt = Number(b.estimate_amount || 0);
    if (amt > value) value = amt;
  }
  let label = company.status || "—";
  if (bestStage) {
    const group = workGroupFromBdStage(bestStage as BdStage);
    label = WORK_GROUP_LABELS[group as WorkGroup] || bestStage.replace(/_/g, " ");
  }
  return { chance: bestChance, label, value };
}

function companyLabel(row: CompanyRow) {
  return row.company || row.name;
}

export default function CrmDirectoryPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [bdRows, setBdRows] = useState<BdLite[]>([]);
  const [projectRows, setProjectRows] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindView, setKindView] = useState<KindView>("companies");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sortKey, setSortKey] = useState<SortKey>("chance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState("Prospect");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactParentId, setContactParentId] = useState("");
  const [members, setMembers] = useState<CompanyMemberRow[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [{ data: companyRows }, { data: contactRows }, { data: bd }, { data: projects }] =
        await Promise.all([
          (supabase as any)
            .from("crm_customers")
            .select(
              "id, name, company, status, lead_status, email, contract_value, org_role, parent_company_id, archived_at"
            )
            .eq("record_kind", "company")
            .is("archived_at", null)
            .order("company", { ascending: true }),
          (supabase as any)
            .from("crm_customers")
            .select("id, name, email, company, status, parent_company_id, archived_at")
            .eq("record_kind", "contact")
            .is("archived_at", null)
            .order("name", { ascending: true }),
          (supabase as any)
            .from("bd_records")
            .select("company_id, stage, estimate_amount"),
          (supabase as any).from("projects").select("client_id, stage"),
        ]);
      setCompanies(companyRows || []);
      setContacts(contactRows || []);
      setBdRows(bd || []);
      setProjectRows(projects || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const contactCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of contacts) {
      if (!c.parent_company_id) continue;
      map.set(c.parent_company_id, (map.get(c.parent_company_id) || 0) + 1);
    }
    return map;
  }, [contacts]);

  const companyById = useMemo(() => {
    const map = new Map<string, CompanyRow>();
    for (const c of companies) map.set(c.id, c);
    return map;
  }, [companies]);

  const ratioByCompany = useMemo(() => {
    const map = new Map<string, StageRatio>();
    for (const p of projectRows) {
      if (!p.client_id) continue;
      const r = map.get(p.client_id) || emptyRatio();
      bumpRatio(r, p.stage);
      map.set(p.client_id, r);
    }
    return map;
  }, [projectRows]);

  const bdByCompany = useMemo(() => {
    const map = new Map<string, BdLite[]>();
    for (const r of bdRows) {
      if (!r.company_id) continue;
      const list = map.get(r.company_id) || [];
      list.push(r);
      map.set(r.company_id, list);
    }
    return map;
  }, [bdRows]);

  const stats = useMemo(() => {
    let clients = 0;
    let prospects = 0;
    let leads = 0;
    for (const c of companies) {
      const derived = derivedCrmStatus(
        ratioByCompany.get(c.id) || emptyRatio(),
        c.status
      );
      if (derived === "Client") clients += 1;
      else if (derived === "Prospect") prospects += 1;
      else if (derived === "Lead") leads += 1;
    }
    const attached = contacts.filter((c) => c.parent_company_id).length;
    return {
      total: companies.length,
      clients,
      prospects,
      leads,
      contacts: contacts.length,
      attached,
      unattached: contacts.length - attached,
    };
  }, [companies, contacts, ratioByCompany]);

  useEffect(() => {
    if (kindView !== "members" || membersLoaded) return;
    void loadCompanyUsersData().then((data) => {
      setMembers((data.members || []).filter((m) => m.status === "active"));
      setMembersLoaded(true);
    });
  }, [kindView, membersLoaded]);

  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = companies
      .filter((c) => {
        const ratio = ratioByCompany.get(c.id) || emptyRatio();
        const derived = derivedCrmStatus(ratio, c.status);
        if (statusFilter && derived !== statusFilter) return false;
        if (!q) return true;
        const parent = c.parent_company_id
          ? companyById.get(c.parent_company_id)
          : null;
        const hay = [
          c.company,
          c.name,
          c.email,
          c.org_role,
          parent?.company,
          parent?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .map((c) => {
        const ratio = ratioByCompany.get(c.id) || emptyRatio();
        const derived = derivedCrmStatus(ratio, c.status);
        const opp = opportunityForCompany(
          { ...c, status: derived },
          bdByCompany.get(c.id) || []
        );
        const parent = c.parent_company_id
          ? companyById.get(c.parent_company_id)
          : null;
        return {
          ...c,
          derivedStatus: derived,
          ratioLabel: ratioLabel(ratio),
          orgBadge: orgRoleBadge(c.org_role),
          parentName: parent ? companyLabel(parent) : null,
          parentId: parent?.id || null,
          contacts: contactCount.get(c.id) || 0,
          chance: opp.chance,
          opportunity: opp.label,
          value: opp.value,
        };
      });

    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "company") {
        cmp = (a.company || a.name).localeCompare(b.company || b.name, undefined, {
          sensitivity: "base",
        });
      } else if (sortKey === "status") {
        cmp = (a.derivedStatus || "").localeCompare(b.derivedStatus || "");
      } else if (sortKey === "contacts") {
        cmp = a.contacts - b.contacts;
      } else if (sortKey === "value") {
        cmp = a.value - b.value;
      } else {
        cmp = a.chance - b.chance;
        if (cmp === 0) cmp = a.value - b.value;
        if (cmp === 0) {
          cmp = (a.company || a.name).localeCompare(b.company || b.name, undefined, {
            sensitivity: "base",
          });
        }
      }
      return cmp * dir;
    });
    return rows;
  }, [
    companies,
    search,
    statusFilter,
    contactCount,
    bdByCompany,
    ratioByCompany,
    companyById,
    sortKey,
    sortDir,
  ]);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!q) return true;
      const parent = c.parent_company_id ? companyById.get(c.parent_company_id) : null;
      const hay = [c.name, c.email, c.company, parent?.company, parent?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, search, companyById]);

  const handleStatClick = (next: StatusFilter) => {
    setKindView("companies");
    setStatusFilter((prev) => (next !== "" && prev === next ? "" : next));
    setSortKey("chance");
    setSortDir("desc");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "company" || key === "status" ? "asc" : "desc");
  };

  const resetAddForm = () => {
    setCompanyName("");
    setContactName("");
    setContactEmail("");
    setContactParentId("");
    setStatus("Prospect");
  };

  const handleAddCompany = async () => {
    const name = companyName.trim();
    if (!name) {
      alert("Company name is required.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: created, error } = await (supabase as any)
      .from("crm_customers")
      .insert([
        {
          name,
          company: name,
          status,
          record_kind: "company",
          parent_company_id: null,
          lead_status: "Reached out",
        },
      ])
      .select("id")
      .single();
    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }
    const person = contactName.trim();
    if (created?.id && person) {
      await (supabase as any).from("crm_customers").insert([
        {
          name: person,
          email: contactEmail.trim() || null,
          record_kind: "contact",
          parent_company_id: created.id,
          company: name,
          status,
        },
      ]);
    }
    setSaving(false);
    setAddMode(null);
    resetAddForm();
    await load();
    if (created?.id) router.push(`/app/crm/${created.id}`);
  };

  const handleAddContact = async () => {
    const name = contactName.trim();
    if (!name) {
      alert("Contact name is required.");
      return;
    }
    const parent = contactParentId ? companyById.get(contactParentId) : null;
    setSaving(true);
    const supabase = createClient();
    const { data: created, error } = await (supabase as any)
      .from("crm_customers")
      .insert([
        {
          name,
          email: contactEmail.trim() || null,
          record_kind: "contact",
          parent_company_id: parent?.id || null,
          company: parent ? companyLabel(parent) : null,
          status: parent?.status || status,
        },
      ])
      .select("id")
      .single();
    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    setAddMode(null);
    resetAddForm();
    await load();
    if (created?.id) router.push(`/app/crm/${created.id}`);
  };

  const companyStatCards: { key: StatusFilter; label: string; value: number }[] = [
    { key: "", label: "Companies", value: stats.total },
    { key: "Client", label: "Clients", value: stats.clients },
    { key: "Prospect", label: "Prospects", value: stats.prospects },
    { key: "Lead", label: "Leads", value: stats.leads },
  ];

  const showingLabel =
    kindView === "contacts"
      ? "contacts"
      : kindView === "members"
        ? "members"
        : statusFilter === "Client"
          ? "clients"
          : statusFilter === "Prospect"
            ? "prospects"
            : statusFilter === "Lead"
              ? "leads"
              : "companies";

  const sortHint =
    sortKey === "chance"
      ? "opportunity"
      : sortKey === "value"
        ? "value"
        : sortKey === "contacts"
          ? "contacts"
          : sortKey;

  const shownCount =
    kindView === "members"
      ? members.length
      : kindView === "contacts"
        ? filteredContacts.length
        : filteredCompanies.length;

  const subtitle =
    kindView === "contacts"
      ? "People in the directory. Attach to a company when you have one."
      : kindView === "members"
        ? "Portal logins. Create a member, then share username and password yourself."
        : "Companies you work with. Switch to Contacts to add a person.";

  const fullFormHref = kindView === "contacts" ? "/app/crm/new?kind=contact" : "/app/crm/new";

  return (
    <Workspace>
      <PageHeader
        title="Directory"
        subtitle={subtitle}
        actions={
          <>
            <Link href="/app/crm/access" className={buttonClass("secondary")}>
              Access
            </Link>
            <Link href={fullFormHref} className={buttonClass("secondary")}>
              Full form
            </Link>
            {kindView === "members" ? (
              <Link href="/app/crm/access" className={buttonClass("primary")}>
                <Plus size={14} strokeWidth={1.75} />
                Invite member
              </Link>
            ) : (
              <Button onClick={() => setAddMode(kindView === "contacts" ? "contact" : "company")}>
                <Plus size={14} strokeWidth={1.75} />
                {kindView === "contacts" ? "Add contact" : "Add company"}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          {(
            [
              { id: "companies", label: "Companies" },
              { id: "contacts", label: "Contacts" },
              { id: "members", label: "Members" },
            ] as const
          ).map((tab) => {
            const selected = kindView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setKindView(tab.id);
                  if (tab.id !== "companies") setStatusFilter("");
                }}
                className={`px-3 py-1.5 text-[13px] font-medium ${
                  selected
                    ? "bg-surface-raised text-text-primary"
                    : "bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        {kindView === "companies" ? (
          <Button variant="ghost" onClick={() => setAddMode("contact")}>
            <Plus size={14} strokeWidth={1.75} />
            Add contact
          </Button>
        ) : kindView === "contacts" ? (
          <Button variant="ghost" onClick={() => setAddMode("company")}>
            <Plus size={14} strokeWidth={1.75} />
            Add company
          </Button>
        ) : null}
      </div>

      {kindView === "companies" ? (
        <Panel className="overflow-hidden mb-3">
          <div className="flex divide-x divide-border overflow-x-auto">
            {companyStatCards.map((s) => {
              const selected = statusFilter === s.key;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleStatClick(s.key)}
                  aria-pressed={selected}
                  className={`flex-1 min-w-[5.5rem] text-left px-4 py-3 transition-colors ${
                    selected ? "bg-surface-raised" : "hover:bg-surface-raised/60"
                  }`}
                >
                  <p className="text-lg font-semibold text-text-primary tabular-nums">
                    {s.value}
                  </p>
                  <p className="text-[12px] text-text-secondary">{s.label}</p>
                </button>
              );
            })}
          </div>
        </Panel>
      ) : kindView === "contacts" ? (
        <Panel className="overflow-hidden mb-3">
          <div className="flex divide-x divide-border">
            <div className="flex-1 px-4 py-3">
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.contacts}</p>
              <p className="text-[12px] text-text-secondary">Contacts</p>
            </div>
            <div className="flex-1 px-4 py-3">
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.attached}</p>
              <p className="text-[12px] text-text-secondary">With company</p>
            </div>
            <div className="flex-1 px-4 py-3">
              <p className="text-lg font-semibold text-text-primary tabular-nums">{stats.unattached}</p>
              <p className="text-[12px] text-text-secondary">No company</p>
            </div>
          </div>
        </Panel>
      ) : null}

      <p className="text-[12px] text-text-secondary mb-4">
        Showing {shownCount} {showingLabel}
        {search.trim() ? ` matching “${search.trim()}”` : ""}
        {kindView === "companies" ? ` · sorted by ${sortHint}${sortDir === "desc" ? " ↓" : " ↑"}` : ""}
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              kindView === "contacts"
                ? "Search contacts…"
                : kindView === "members"
                  ? "Search members…"
                  : "Search companies…"
            }
            className="w-full border border-border rounded-md pl-8 pr-3 py-2 text-[13px]"
          />
        </div>
        {kindView === "companies" ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="border border-border rounded-md px-3 py-2 text-[13px] bg-surface"
          >
            <option value="">All statuses</option>
            <option value="Prospect">Prospect</option>
            <option value="Lead">Lead</option>
            <option value="Client">Client</option>
          </select>
        ) : null}
      </div>

      {kindView === "members" ? (
        !membersLoaded ? (
          <p className="text-[13px] text-text-secondary">Loading members…</p>
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-raised text-[11px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Member</th>
                  <th className="px-4 py-2 font-semibold">Company</th>
                  <th className="px-4 py-2 font-semibold">CRM</th>
                </tr>
              </thead>
              <tbody>
                {members
                  .filter((m) => {
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return [m.user_name, m.user_email, m.company_name]
                      .join(" ")
                      .toLowerCase()
                      .includes(q);
                  })
                  .map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="px-4 py-2.5 text-[13px]">
                        <p className="font-medium text-text-primary">{m.user_name}</p>
                        <p className="text-[12px] text-text-muted">{m.user_email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">
                        <Link
                          href={`/app/crm/${m.company_id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {m.company_name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]">
                        {m.contact_id ? (
                          <Link href={`/app/crm/${m.contact_id}`} className="text-blue-700 hover:underline">
                            Open contact
                          </Link>
                        ) : (
                          <Link
                            href={`/app/crm/access?company=${encodeURIComponent(m.company_id)}`}
                            className="text-blue-700 hover:underline"
                          >
                            Link in Access
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Panel>
        )
      ) : kindView === "contacts" ? (
        loading ? (
          <p className="text-[13px] text-text-secondary">Loading contacts…</p>
        ) : filteredContacts.length === 0 ? (
          <EmptyState>
            No contacts yet. Add a person — company is optional.
          </EmptyState>
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-raised text-[11px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Contact</th>
                  <th className="px-4 py-2 font-semibold">Company</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredContacts.map((c) => {
                  const parent = c.parent_company_id ? companyById.get(c.parent_company_id) : null;
                  const parentName = parent ? companyLabel(parent) : c.company;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-surface-raised cursor-pointer"
                      onClick={() => router.push(`/app/crm/${c.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-text-primary">{c.name}</p>
                        <p className="text-[11px] text-text-muted">{c.email || "No email"}</p>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-text-secondary">
                        {parent ? (
                          <Link
                            href={`/app/crm/${parent.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-700 hover:underline"
                          >
                            {parentName}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-text-secondary">{c.status || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )
      ) : loading ? (
        <p className="text-[13px] text-text-secondary">Loading companies…</p>
      ) : filteredCompanies.length === 0 ? (
        <EmptyState>
          No companies in this view. Click a score card or clear search.
        </EmptyState>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-raised text-[11px] uppercase tracking-wider text-text-muted">
              <tr>
                {(
                  [
                    { key: "company", label: "Company" },
                    { key: "status", label: "Status" },
                    { key: "chance", label: "Opportunity" },
                    { key: "value", label: "Value" },
                    { key: "contacts", label: "Contacts" },
                  ] as const
                ).map((col) => {
                  const active = sortKey === col.key;
                  return (
                    <th key={col.key} className="px-4 py-2 font-semibold">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-text-primary ${
                          active ? "text-text-primary" : ""
                        }`}
                      >
                        {col.label}
                        {active ? (
                          sortDir === "desc" ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ArrowUp size={12} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="opacity-40" />
                        )}
                      </button>
                    </th>
                  );
                })}
                <th className="px-4 py-2 font-semibold">Work</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCompanies.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-surface-raised cursor-pointer"
                  onClick={() => router.push(`/app/crm/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-text-primary">
                        {c.company || c.name}
                      </p>
                      {c.orgBadge ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                          {c.orgBadge}
                        </span>
                      ) : null}
                    </div>
                    {c.parentName && c.parentId ? (
                      <p className="text-[11px] text-text-muted mt-0.5">
                        under{" "}
                        <Link
                          href={`/app/crm/${c.parentId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-700 hover:underline"
                        >
                          {c.parentName}
                        </Link>
                      </p>
                    ) : null}
                    {c.email ? (
                      <p className="text-[11px] text-text-muted">{c.email}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text-secondary">
                    <p className="font-medium text-text-primary">{c.derivedStatus}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">{c.ratioLabel}</p>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-text-secondary">{c.opportunity}</td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-text-secondary">
                    {c.value > 0 ? formatEuro(c.value) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[12px] tabular-nums text-text-secondary">
                    {c.contacts}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={workPaths.company(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[12px] font-medium text-text-primary hover:underline"
                    >
                      Open Work
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {addMode === "company" ? (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 max-h-[100dvh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Add company</h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Company is required. A first contact is optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddMode(null);
                  resetAddForm();
                }}
                className="text-gray-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">Company name</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px]"
                  placeholder="Acme GmbH"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white"
                >
                  <option value="Prospect">Prospect</option>
                  <option value="Lead">Lead</option>
                  <option value="Client">Client</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Contact name <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px]"
                  placeholder="Jane Client"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Contact email <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px]"
                  placeholder="jane@acme.com"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 mt-5">
              <Link href="/app/crm/new" className="text-[12px] text-blue-700 hover:underline">
                Full form
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode(null);
                    resetAddForm();
                  }}
                  className="px-3 py-2 text-[13px] text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleAddCompany()}
                  className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {addMode === "contact" ? (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full p-5 shadow-xl border border-gray-200 max-h-[100dvh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-gray-900">Add contact</h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Name is enough. Company is optional — leave blank for Gmail / freelance people.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddMode(null);
                  resetAddForm();
                }}
                className="text-gray-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">Name</span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px]"
                  placeholder="Jane Client"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Email <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px]"
                  placeholder="jane@acme.com"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-semibold text-gray-700">
                  Company <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <select
                  value={contactParentId}
                  onChange={(e) => setContactParentId(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white"
                >
                  <option value="">No company yet</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {companyLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              {!contactParentId ? (
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">Status</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-[13px] bg-white"
                  >
                    <option value="Prospect">Prospect</option>
                    <option value="Lead">Lead</option>
                    <option value="Client">Client</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 mt-5">
              <Link href="/app/crm/new?kind=contact" className="text-[12px] text-blue-700 hover:underline">
                Full form
              </Link>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode(null);
                    resetAddForm();
                  }}
                  className="px-3 py-2 text-[13px] text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleAddContact()}
                  className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Add contact"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Workspace>
  );
}
