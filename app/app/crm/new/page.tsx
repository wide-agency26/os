"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

type CompanyOption = { id: string; name: string; company: string | null };

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<Workspace><div className="p-8 text-gray-500 text-sm">Loading…</div></Workspace>}>
      <NewCustomerForm />
    </Suspense>
  );
}

function NewCustomerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recordKind, setRecordKind] = useState<"company" | "contact">("company");
  const [parentCompanyId, setParentCompanyId] = useState("");
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    position: "",
    linkedin: "",
    industry: "",
    notes: "",
    status: "Prospect",
    source: "",
    source_category: "Activation",
    role: "Decision Maker",
    lead_status: "Reached out",
    subscriber_status: "Active"
  });
  
  const [loading, setLoading] = useState(false);
  const [extraPeople, setExtraPeople] = useState<
    { name: string; email: string }[]
  >([{ name: "", email: "" }]);

  useEffect(() => {
    const kind = searchParams.get("kind");
    if (kind === "company" || kind === "contact") {
      setRecordKind(kind);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadCompanies() {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("crm_customers")
        .select("id, name, company")
        .eq("record_kind", "company")
        .order("company", { ascending: true });
      setCompanies(data || []);
    }
    void loadCompanies();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRecordKindChange = (value: "company" | "contact") => {
    setRecordKind(value);
    if (value === "company") {
      setParentCompanyId("");
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert("Please provide the Name.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const isCompany = recordKind === "company";
    const companyName = isCompany ? formData.name : formData.company;

    const payload = {
      ...formData,
      company: companyName || null,
      record_kind: recordKind,
      parent_company_id: isCompany ? null : parentCompanyId || null,
    };

    const { data: created, error } = await (supabase as any)
      .from("crm_customers")
      .insert([payload])
      .select("id")
      .single();
    
    if (error) {
      alert("Error creating record: " + error.message);
      setLoading(false);
      return;
    }

    // Best-effort: if a contact has a company name but no explicit parent,
    // try to match it to an existing company record by name.
    if (!isCompany && !parentCompanyId && companyName?.trim()) {
      const match = companies.find(
        (c) => (c.company || c.name).trim().toLowerCase() === companyName.trim().toLowerCase()
      );
      if (match && created?.id) {
        await (supabase as any)
          .from("crm_customers")
          .update({ parent_company_id: match.id })
          .eq("id", created.id);
      }
    }

    if (isCompany && created?.id) {
      const people = extraPeople
        .map((p) => ({ name: p.name.trim(), email: p.email.trim() }))
        .filter((p) => p.name);
      if (people.length) {
        await (supabase as any).from("crm_customers").insert(
          people.map((p) => ({
            name: p.name,
            email: p.email || null,
            record_kind: "contact",
            parent_company_id: created.id,
            company: companyName,
            status: formData.status || "Prospect",
          }))
        );
      }
    }

    if (formData.status === 'Client' && formData.email) {
      try {
        const syncRes = await fetch('/api/admin/sync-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            company: companyName
          })
        });
        if (!syncRes.ok) {
          console.error("Failed to sync CRM client to auth system.");
        }
      } catch (err) {
        console.error("Error syncing client:", err);
      }
    }

    setLoading(false);
    router.push(`/app/crm`);
  };

  return (
    <Workspace>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/crm" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">New CRM record</h2>
              <p className="text-sm text-gray-500 mt-1">
                Company first, then the people on the deal. Optional value lands in Unidentified.
              </p>
            </div>
          </div>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? "Saving..." : "Save Record"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Section title="Record Type">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select
                    value={recordKind}
                    onChange={(e) => handleRecordKindChange(e.target.value as "company" | "contact")}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="contact">Contact</option>
                    <option value="company">Company</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {recordKind === "company"
                      ? "Companies are orgs — the Name field below becomes the company name."
                      : "Contacts are people under a company."}
                  </p>
                </div>
                {recordKind === "contact" && (
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Parent Company</label>
                    <select
                      value={parentCompanyId}
                      onChange={(e) => setParentCompanyId(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">No parent company</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company || c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Basic Details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">
                    {recordKind === "company" ? "Company Name" : "Name"} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                {recordKind === "contact" && (
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Company</label>
                    <input type="text" name="company" value={formData.company} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Position</label>
                  <input type="text" name="position" value={formData.position} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Industry</label>
                  <input type="text" name="industry" value={formData.industry} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">LinkedIn URL</label>
                  <input type="text" name="linkedin" value={formData.linkedin} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </Section>

            {recordKind === "company" && (
              <Section title="People on this deal">
                <p className="text-[11px] text-gray-500 mb-3">
                  Add the 1–2 names from the event. They stay on the company, not as a second pipeline value.
                </p>
                <div className="space-y-3">
                  {extraPeople.map((person, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Name"
                        value={person.name}
                        onChange={(e) =>
                          setExtraPeople((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p))
                          )
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="email"
                        placeholder="Email (optional)"
                        value={person.email}
                        onChange={(e) =>
                          setExtraPeople((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, email: e.target.value } : p))
                          )
                        }
                        className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                  {extraPeople.length < 2 && (
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-blue-700"
                      onClick={() => setExtraPeople((prev) => [...prev, { name: "", email: "" }])}
                    >
                      + Add person
                    </button>
                  )}
                </div>
              </Section>
            )}

            <p className="text-[12px] text-gray-500">
              Put a rough service and value on the Work pipeline card after you create
              this company — not here. CRM is identity only.
            </p>

            <Section title="Notes">
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Additional details..."></textarea>
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="CRM Status">
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="Prospect">Prospect</option>
                    <option value="Lead">Lead</option>
                    <option value="Client">Client</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Lead Status</label>
                  <select name="lead_status" value={formData.lead_status} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="Reached out">Reached out</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                    <option value="On-hold">On-hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Role in Company</label>
                  <select name="role" value={formData.role} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="Decision Maker">Decision Maker</option>
                    <option value="Team Member">Team Member</option>
                    <option value="Connection">Connection</option>
                    <option value="Freelancer">Freelancer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Source Category</label>
                  <select name="source_category" value={formData.source_category} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="Activation">Activation</option>
                    <option value="Event">Event</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Specific Source (Name)</label>
                  <input type="text" name="source" value={formData.source} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1">Subscriber Status</label>
                  <select name="subscriber_status" value={formData.subscriber_status} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                    <option value="Active">Active</option>
                    <option value="On-hold">On-hold</option>
                    <option value="Opt-out">Opt-out</option>
                  </select>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </Workspace>
  );
}
