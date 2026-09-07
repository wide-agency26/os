"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  createCommercialProject,
  lookupOpenLeadProject,
} from "@/app/actions/projects-commercial";
import { OfferingChips } from "@/components/offerings/OfferingChips";
import type { OfferingChip } from "@/lib/offerings/types";

type CompanyOpt = {
  id: string;
  label: string;
  status: string | null;
};
type ContactOpt = { id: string; name: string; email: string | null };
type SowOpt = { id: string; title: string; companyId: string };

export function NewProjectForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"lead" | "client">("lead");
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [sows, setSows] = useState<SowOpt[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [projectTypes, setProjectTypes] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newPerson, setNewPerson] = useState({ name: "", email: "" });
  const [title, setTitle] = useState("");
  const [offerings, setOfferings] = useState<OfferingChip[]>([]);
  const [versionOfId, setVersionOfId] = useState("");
  const [separateDeal, setSeparateDeal] = useState(false);
  const [openLead, setOpenLead] = useState<{ id: string; title: string } | null>(null);
  const [dealValue, setDealValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [projectTypeId, setProjectTypeId] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [department, setDepartment] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const [
        { data: companyData },
        { data: sowData },
        { data: tplData },
        { data: typeData },
      ] = await Promise.all([
        supabase
          .from("crm_customers")
          .select("id, name, company, status")
          .eq("record_kind", "company")
          .order("company"),
        supabase.from("sows").select("id, title, company_id").order("updated_at", { ascending: false }).limit(200),
        supabase.from("project_templates").select("id, name"),
        supabase.from("project_types").select("id, name").order("name"),
      ]);
      setCompanies(
        (companyData ?? []).map((c) => ({
          id: c.id,
          label: c.company || c.name || "Untitled",
          status: c.status,
        }))
      );
      setSows(
        (sowData ?? [])
          .filter((s): s is typeof s & { company_id: string } => Boolean(s.company_id))
          .map((s) => ({
            id: s.id,
            title: s.title,
            companyId: s.company_id,
          }))
      );
      setTemplates(tplData ?? []);
      setProjectTypes(typeData ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!companyId) {
      setContacts([]);
      setSelectedContacts([]);
      setOpenLead(null);
      return;
    }
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("crm_customers")
        .select("id, name, email")
        .eq("record_kind", "contact")
        .eq("parent_company_id", companyId)
        .order("name");
      setContacts(
        (data ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
        }))
      );
      const lead = await lookupOpenLeadProject(companyId);
      setOpenLead(lead.ok ? lead.project : null);
      setSeparateDeal(false);
    })();
  }, [companyId]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return companies.filter((c) => (q ? c.label.toLowerCase().includes(q) : true));
  }, [companies, companyQuery]);

  const companySows = sows.filter((s) => s.companyId === companyId);
  const selectedCompany = companies.find((c) => c.id === companyId);

  async function ensureCompany(): Promise<string | null> {
    if (companyId) return companyId;
    const name = newCompanyName.trim();
    if (!name) return null;
    const supabase = createClient();
    const { data, error: insErr } = await supabase
      .from("crm_customers")
      .insert({
        name,
        company: name,
        record_kind: "company",
        status: "Prospect",
      })
      .select("id")
      .single();
    if (insErr || !data) {
      setError(insErr?.message || "Could not create company");
      return null;
    }
    setCompanies((prev) => [...prev, { id: data.id, label: name, status: "Prospect" }]);
    setCompanyId(data.id);
    setShowNewCompany(false);
    setNewCompanyName("");
    return data.id;
  }

  async function addPerson() {
    const name = newPerson.name.trim();
    if (!name || !companyId) return;
    const supabase = createClient();
    const { data, error: insErr } = await supabase
      .from("crm_customers")
      .insert({
        name,
        email: newPerson.email.trim() || null,
        record_kind: "contact",
        parent_company_id: companyId,
        company: selectedCompany?.label || name,
        status: "Prospect",
      })
      .select("id, name, email")
      .single();
    if (insErr || !data) {
      setError(insErr?.message || "Could not add person");
      return;
    }
    setContacts((prev) => [...prev, { id: data.id, name: data.name, email: data.email }]);
    setSelectedContacts((prev) => [...prev, data.id]);
    setNewPerson({ name: "", email: "" });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const cid = await ensureCompany();
      if (!cid) {
        setError("Pick or create a company.");
        return;
      }
      const companyLabel = companies.find((c) => c.id === cid)?.label || newCompanyName;
      const pkgName = offerings.find((o) => o.kind === "package")?.name;
      const packageId = offerings.find((o) => o.kind === "package")?.catalogId ?? null;
      const serviceIds = offerings
        .filter((o) => o.kind === "service")
        .map((o) => o.catalogId);
      const defaultTitle =
        title.trim() ||
        (kind === "lead"
          ? `${companyLabel}${pkgName ? ` — ${pkgName}` : " — Proposal"}`
          : `${companyLabel} — Engagement`);
      const res = await createCommercialProject({
        kind,
        companyId: cid,
        title: defaultTitle,
        contactIds: selectedContacts,
        packageId,
        serviceIds: serviceIds.length ? serviceIds : undefined,
        versionOfId: versionOfId || null,
        separateDeal: kind === "lead" ? separateDeal : false,
        dealValue: kind === "client" && dealValue ? Number(dealValue) : null,
        expectedStartDate: kind === "client" ? startDate || null : null,
        expectedEndDate: kind === "client" ? endDate || null : null,
        templateId: kind === "client" ? templateId || null : null,
        projectTypeId: projectTypeId || null,
        priority,
        department: department || null,
      });
      if (!res.ok || !res.redirectTo) {
        setError(res.error || "Could not create project");
        return;
      }
      router.push(res.redirectTo);
    });
  }

  return (
    <Workspace>
      <div className="max-w-3xl mx-auto pb-16">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/app/projects" className="text-gray-400 hover:text-gray-900">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">New project</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Lead proposals go to Identified. Signed work starts as Actual.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
          {(
            [
              {
                id: "lead" as const,
                title: "Lead",
                body: "Proposal in progress. Value goes to Identified when the SOW has a price.",
              },
              {
                id: "client" as const,
                title: "Client",
                body: "Signed work. Project starts now. Value goes to Actual.",
              },
            ]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setKind(opt.id)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                kind === opt.id
                  ? "border-gray-900 bg-gray-950 text-white"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-semibold">{opt.title}</p>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  kind === opt.id ? "text-gray-300" : "text-gray-500"
                }`}
              >
                {opt.body}
              </p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mb-6">
          Unidentified is for CRM prospects before a project exists.
        </p>

        <section className="space-y-3 mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Who</p>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">Company</label>
            <button
              type="button"
              className="text-[11px] font-semibold text-blue-700"
              onClick={() => setShowNewCompany((v) => !v)}
            >
              + New company
            </button>
          </div>
          {showNewCompany && (
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg bg-gray-900 text-white text-xs font-semibold px-3"
                onClick={() => void ensureCompany()}
              >
                Add
              </button>
            </div>
          )}
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

          {openLead && kind === "lead" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 space-y-2">
              <p>
                This company already has an open Lead project:{" "}
                <span className="font-semibold">{openLead.title}</span>
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!separateDeal}
                  onChange={(e) => setSeparateDeal(!e.target.checked)}
                />
                Continue that deal (recommended)
              </label>
            </div>
          )}

          <p className="text-xs font-medium text-gray-700 pt-1">Contacts on this deal</p>
          <div className="flex flex-wrap gap-1.5">
            {contacts.map((c) => {
              const on = selectedContacts.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelectedContacts((prev) =>
                      on ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border ${
                    on
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
            {contacts.length === 0 && companyId && (
              <p className="text-xs text-gray-400">No people yet — add one below.</p>
            )}
          </div>
          {companyId && (
            <div className="flex flex-wrap gap-2">
              <input
                className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Name"
                value={newPerson.name}
                onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="flex-1 min-w-[140px] rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Email (optional)"
                value={newPerson.email}
                onChange={(e) => setNewPerson((p) => ({ ...p, email: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => void addPerson()}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-semibold"
              >
                <Plus size={12} /> Add person
              </button>
            </div>
          )}
        </section>

        {kind === "lead" ? (
          <section className="space-y-3 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Proposal</p>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Project / SOW title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">Packages & services</p>
              <OfferingChips
                value={offerings}
                persist={false}
                onChanged={setOfferings}
              />
              <p className="text-[11px] text-text-muted">
                One package max, plus any extra services. Tags the project — does not generate a SOW or tasks by itself.
              </p>
            </div>
            {companySows.length > 0 && (
              <select
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={versionOfId}
                onChange={(e) => setVersionOfId(e.target.value)}
              >
                <option value="">New SOW (version 1)</option>
                {companySows.map((s) => (
                  <option key={s.id} value={s.id}>
                    Later version of: {s.title}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-gray-500">
              Identified value comes from the SOW (lower of versions). Start date is set when the contract is confirmed.
            </p>
          </section>
        ) : (
          <section className="space-y-3 mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Delivery</p>
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Project name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-700">Packages & services</p>
              <OfferingChips
                value={offerings}
                persist={false}
                onChanged={setOfferings}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="date"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <input
                type="number"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="Deal value (net EUR)"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
              />
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">No task template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </section>
        )}

        <button
          type="button"
          className="text-xs font-semibold text-gray-500 mb-3"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide" : "Show"} advanced
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={projectTypeId}
              onChange={(e) => setProjectTypeId(e.target.value)}
            >
              <option value="">Project type</option>
              {projectTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-md bg-accent text-white text-sm font-semibold px-4 py-2.5 hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : null}
          {kind === "lead" ? "Create Lead project" : "Create project"}
        </button>
      </div>
    </Workspace>
  );
}
