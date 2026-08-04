"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Building2, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface CompanyPickerModalProps {
  userId: string;
  onRequestSubmitted: (companyName: string) => void;
}

export function CompanyPickerModal({ userId, onRequestSubmitted }: CompanyPickerModalProps) {
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCompanies() {
      const supabase = createClient();
      const { data, error } = await (supabase as any)
        .from("crm_customers")
        .select("id, company, name")
        .order("company");

      if (error) {
        console.error("Error loading companies:", error);
        setError("Failed to load company directory. Please refresh.");
      } else if (data) {
        const formatted = data.map((c: any) => ({
          id: c.id,
          name: c.company || c.name || "Untitled Organization"
        }));
        setCompanies(formatted);
        if (formatted.length > 0) setSelectedCompanyId(formatted[0].id);
      }
      setLoading(false);
    }
    loadCompanies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !userId) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: insertErr } = await (supabase as any)
        .from("company_members")
        .insert({
          user_id: userId,
          company_id: selectedCompanyId,
          status: "pending",
          source: "self_service"
        });

      if (insertErr) {
        if (insertErr.code === "23505") {
          // Already requested
          const comp = companies.find((c) => c.id === selectedCompanyId);
          onRequestSubmitted(comp?.name || "Selected Company");
          return;
        }
        throw insertErr;
      }

      const comp = companies.find((c) => c.id === selectedCompanyId);
      onRequestSubmitted(comp?.name || "Selected Company");
    } catch (err: any) {
      console.error("Error requesting access:", err);
      setError(`Failed to submit access request: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100">
          <Building2 className="w-6 h-6" />
        </div>

        <h1 className="text-xl font-bold text-center text-gray-900 mb-2">Select Your Organization</h1>
        <p className="text-xs text-center text-gray-500 mb-6 leading-relaxed">
          Please select your company to request access to your brand guidelines and workspace assets.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex justify-center items-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search company name..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Select Input / List */}
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-1 space-y-1 bg-white">
              {filteredCompanies.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">No matching organizations found</div>
              ) : (
                filteredCompanies.map((c) => {
                  const isSelected = selectedCompanyId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedCompanyId}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Request Access</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
