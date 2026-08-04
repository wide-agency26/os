"use client";

import React from "react";
import { XCircle, Building2, LogOut, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface RejectedAccessCardProps {
  companyName: string;
  onSelectDifferentCompany: () => void;
}

export function RejectedAccessCard({ companyName, onSelectDifferentCompany }: RejectedAccessCardProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200 shadow-sm">
          <XCircle className="w-7 h-7" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-red-100/70 text-red-800 mb-3">
          Request Not Approved
        </span>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Not Granted</h1>

        <p className="text-xs text-gray-600 leading-relaxed mb-6">
          Your request to access brand guidelines for{" "}
          <strong className="text-gray-900 font-semibold">{companyName}</strong> was not approved by the WIDE Team.
          If you believe this is a mistake, please contact your agency administrator, or select a different organization below.
        </p>

        <div className="space-y-3">
          <button
            onClick={onSelectDifferentCompany}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            <span>Request Access for Different Company</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
