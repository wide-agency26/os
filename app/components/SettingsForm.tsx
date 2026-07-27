"use client";

import { useState } from "react";
import { updateProfile } from "@/app/actions/profile";

interface SettingsFormProps {
  initialFullName: string;
  initialCompanyName: string;
}

export default function SettingsForm({ initialFullName, initialCompanyName }: SettingsFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("full_name", fullName);
    formData.append("company_name", companyName);

    try {
      const result = await updateProfile(formData);
      
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "Profile updated successfully." });
      }
    } catch (err) {
       setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 lg:p-8 max-w-2xl">
      <h2 className="text-lg font-medium text-text-primary mb-6">Profile Details</h2>
      
      {message && (
        <div className={`px-4 py-3 rounded-lg mb-6 text-sm border ${
          message.type === "success" 
            ? "bg-success/10 text-success border-success/20" 
            : "bg-danger/10 text-danger border-danger/20"
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="full_name" className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
            Full Name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full px-4 py-3 bg-surface-raised border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div>
          <label htmlFor="company_name" className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
            Company Name
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full px-4 py-3 bg-surface-raised border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div className="pt-4 flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || (fullName === initialFullName && companyName === initialCompanyName)}
            className="px-6 py-2.5 bg-white text-black text-sm font-semibold tracking-wide rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
