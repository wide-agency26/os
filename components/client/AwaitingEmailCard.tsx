"use client";

import React, { useState } from "react";
import { Mail, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { performSignOut } from "@/lib/auth/sign-out";

interface AwaitingEmailCardProps {
  email?: string;
}

export function AwaitingEmailCard({ email }: AwaitingEmailCardProps) {
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const supabase = createClient();
      await supabase.auth.resend({
        type: "signup",
        email: email
      });
      setSent(true);
    } catch (e) {
      console.error("Error resending verification email:", e);
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = () => {
    void performSignOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 shadow-xl text-center">
        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
          <Mail className="w-7 h-7" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100/70 text-blue-800 mb-3">
          Verification Required
        </span>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Check Your Email to Continue</h1>

        <p className="text-xs text-gray-600 leading-relaxed mb-6">
          We sent a confirmation link to{" "}
          <strong className="text-gray-900 font-semibold">{email || "your email address"}</strong>. Please click the link to verify your account and proceed to organization setup.
        </p>

        {sent && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Verification email sent! Check your inbox.</span>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
            <span>{resending ? "Sending..." : "Resend Verification Email"}</span>
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
