"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/frappe-ui/primitives";
import { requestCompanyAccess } from "@/app/actions/client-access";

interface CompanyPickerModalProps {
  userId: string;
  onResolved: (next: { state: "active" | "pending"; companyName: string }) => void;
}

export function CompanyPickerModal({ userId, onResolved }: CompanyPickerModalProps) {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanies() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, company, name")
        .eq("record_kind", "company")
        .order("company");

      if (error) {
        console.error("Error loading companies:", error);
        setError("Failed to load company directory. Please refresh.");
      } else if (data) {
        const formatted = data.map((c) => ({
          id: c.id,
          name: c.company || c.name || "Untitled Organization",
        }));
        setCompanies(formatted);
        if (formatted.length > 0) setSelectedCompanyId(formatted[0].id);
      }
      setLoading(false);
    }
    void loadCompanies();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await requestCompanyAccess(selectedCompanyId);
      if (res.error || !res.state || !res.companyName) {
        setError(res.error || "Could not submit the access request.");
        return;
      }
      onResolved({ state: res.state, companyName: res.companyName });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit access request.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-lg border border-border p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted text-center mb-2">
          Access
        </p>
        <h1 className="text-xl font-semibold text-center text-text-primary mb-2">
          Select your organization
        </h1>
        <p className="text-[13px] text-center text-text-secondary mb-6 leading-relaxed">
          Choose your company to request access to guidelines, reports, and project files.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search company name…"
                className="w-full pl-9 pr-4 py-2.5 min-h-11 bg-surface border border-border rounded-lg text-[13px] outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-1 space-y-1 bg-surface">
              {filteredCompanies.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-text-muted">
                  No matching organizations found
                </div>
              ) : (
                filteredCompanies.map((c) => {
                  const isSelected = selectedCompanyId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      className={`flex items-center justify-between p-2.5 min-h-11 rounded-md text-[13px] cursor-pointer ${
                        isSelected
                          ? "bg-accent text-white font-medium"
                          : "hover:bg-surface-raised text-text-primary"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {isSelected ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : null}
                    </div>
                  );
                })
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting || !selectedCompanyId}
              className="w-full"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request access"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
