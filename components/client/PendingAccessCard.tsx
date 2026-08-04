"use client";

import React from "react";
import { Clock, ShieldCheck, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface PendingAccessCardProps {
  companyName: string;
}

export function PendingAccessCard({ companyName }: PendingAccessCardProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/80 shadow-sm animate-pulse">
          <Clock className="w-7 h-7" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100/70 text-amber-800 mb-3">
          Pending Approval
        </span>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Request Under Review</h1>

        <p className="text-xs text-gray-600 leading-relaxed mb-6">
          Your request to access brand guidelines and project assets for{" "}
          <strong className="text-gray-900 font-semibold">{companyName}</strong> is currently pending review by the WIDE Team.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 text-left space-y-2 mb-6">
          <div className="flex items-center gap-2 font-semibold text-gray-700">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Why is review required?</span>
          </div>
          <p className="leading-relaxed">
            To safeguard proprietary design tokens and brand guidelines, access requests are verified by a WIDE administrator before publishing.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
