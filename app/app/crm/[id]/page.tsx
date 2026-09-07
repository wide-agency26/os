"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";
import { CompanyContextPanel } from "@/components/crm/CompanyContextPanel";
import { InviteContactAsMember } from "@/components/crm/InviteContactAsMember";
import { CompanyLogoEditor } from "@/components/crm/CompanyLogo";
import { ContextBankPanel } from "@/components/context-bank/ContextBankPanel";

type CompanyOption = { id: string; name: string; company: string | null };

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [recordKind, setRecordKind] = useState<"company" | "contact">("contact");
  const [parentCompanyId, setParentCompanyId] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [originalStatus, setOriginalStatus] = useState("Prospect");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    position: "",
    linkedin: "",
    website: "",
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
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      setFetching(true);
      try {
        const supabase = createClient();
        const { data, error } = await (supabase as any)
          .from("crm_customers")
          .select(
            "id, name, email, company, position, linkedin, website, industry, notes, status, source, source_category, role, lead_status, subscriber_status, record_kind, parent_company_id, logo_url"
          )
          .eq("id", id)
          .maybeSingle();

        if (error) {
          console.error(error);
        }

        if (data) {
          setFormData({
            name: data.name || "",
            email: data.email || "",
            company: data.company || "",
            position: data.position || "",
            linkedin: data.linkedin || "",
            website: data.website || "",
            industry: data.industry || "",
            notes: data.notes || "",
            status: data.status || "Prospect",
            source: data.source || "",
            source_category: data.source_category || "Activation",
            role: data.role || "Decision Maker",
            lead_status: data.lead_status || "Reached out",
            subscriber_status: data.subscriber_status || "Active"
          });
          setOriginalStatus(data.status || "Prospect");
          setRecordKind(data.record_kind === "company" ? "company" : "contact");
          setParentCompanyId(data.parent_company_id || "");
          setLogoUrl(data.logo_url || null);

          if (data.record_kind !== "company") {
            const { data: companyRows } = await (supabase as any)
              .from("crm_customers")
              .select("id, name, company")
              .eq("record_kind", "company")
              .neq("id", id)
              .order("company", { ascending: true });
            setCompanies(companyRows || []);
          } else {
            setCompanies([]);
          }
        }
      } finally {
        setFetching(false);
      }
    }
    void fetchData();
  }, [id]);

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
      updated_at: new Date().toISOString()
    };

    const { error } = await (supabase as any)
      .from("crm_customers")
      .update(payload)
      .eq("id", id);
    
    setLoading(false);

    if (error) {
      alert("Error updating record: " + error.message);
      return;
    }

    // Best-effort: if a contact has a company name but no explicit parent,
    // try to match it to an existing company record by name.
    if (!isCompany && !parentCompanyId && companyName?.trim()) {
      const match = companies.find(
        (c) => (c.company || c.name).trim().toLowerCase() === companyName.trim().toLowerCase()
      );
      if (match) {
        await (supabase as any)
          .from("crm_customers")
          .update({ parent_company_id: match.id })
          .eq("id", id);
      }
    }

    // Mirror the create flow: newly-won clients get synced into the auth system.
    if (
      formData.status === "Client" &&
      originalStatus !== "Client" &&
      formData.email
    ) {
      try {
        const syncRes = await fetch("/api/admin/sync-client", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            company: companyName,
          }),
        });
        if (!syncRes.ok) {
          console.error("Failed to sync CRM client to auth system.");
        }
      } catch (err) {
        console.error("Error syncing client:", err);
      }
    }

    router.push(`/app/crm`);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this record? This cannot be undone.")) return;
    
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("crm_customers")
      .delete()
      .eq("id", id);
    
    setLoading(false);
    if (error) {
      alert("Error deleting record: " + error.message);
    } else {
      router.push(`/app/crm`);
    }
  };

  if (fetching) {
    return <Workspace><div className="p-8 text-center text-gray-500">Loading record...</div></Workspace>;
  }

  return (
    <Workspace>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <a href="/app/crm" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </a>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit CRM Record</h2>
              <p className="text-sm text-gray-500 mt-1">{formData.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <Trash size={16} />
              Delete
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="px-4 py-2 bg-accent text-white rounded-md text-[13px] font-medium hover:bg-accent-hover transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {recordKind === "company" ? <CompanyContextPanel companyId={id} /> : null}
        {recordKind === "company" ? (
          <div className="mb-8">
            <ContextBankPanel companyId={id} />
          </div>
        ) : null}

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
                {recordKind === "company" && (
                  <div className="md:col-span-2">
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">Website</label>
                    <input type="text" name="website" value={formData.website} onChange={handleChange} placeholder="https://client.com" className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-3" />
                    <CompanyLogoEditor
                      companyId={id}
                      label={formData.name || formData.company || "Company"}
                      logoUrl={logoUrl}
                      website={formData.website || null}
                    />
                  </div>
                )}
              </div>
            </Section>

            <p className="text-[12px] text-gray-500">
              Deal value, service, and retainer dates live on the Work pipeline card
              (prospects) or the project / SOW (leads and live). CRM stays identity only.
            </p>

            <Section title="Notes">
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="Additional details..."></textarea>
            </Section>
          </div>

          <div className="space-y-6">
            {recordKind === "contact" ? (
              <Section title="Portal access">
                <InviteContactAsMember
                  companyId={parentCompanyId || null}
                  contactId={id}
                  contactName={formData.name}
                  contactEmail={formData.email}
                />
                {parentCompanyId ? (
                  <p className="mt-3">
                    <Link
                      href={`/app/crm/access?company=${encodeURIComponent(parentCompanyId)}&contact=${encodeURIComponent(id)}`}
                      className="text-[12px] text-blue-700 hover:underline"
                    >
                      Manage access
                    </Link>
                  </p>
                ) : null}
              </Section>
            ) : null}
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
