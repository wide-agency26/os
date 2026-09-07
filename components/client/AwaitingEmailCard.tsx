"use client";

import React, { useState } from "react";
import { Mail, RefreshCw, LogOut, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { performSignOut } from "@/lib/auth/sign-out";
import { Button } from "@/components/frappe-ui/primitives";

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
        email: email,
      });
      setSent(true);
    } catch (e) {
      console.error("Error resending verification email:", e);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-lg border border-border p-8 text-center">
        <Mail className="w-6 h-6 text-text-primary mx-auto mb-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
          Verification required
        </p>
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Check your email to continue
        </h1>
        <p className="text-[13px] text-text-secondary leading-relaxed mb-6">
          We sent a confirmation link to{" "}
          <strong className="text-text-primary font-medium">
            {email || "your email address"}
          </strong>
          . Click the link to verify your account and continue setup.
        </p>

        {sent ? (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[13px] text-emerald-700 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Verification email sent. Check your inbox.</span>
          </div>
        ) : null}

        <div className="space-y-2">
          <Button
            onClick={handleResend}
            disabled={resending}
            className="w-full"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
            {resending ? "Sending…" : "Resend verification email"}
          </Button>
          <Button variant="secondary" onClick={() => void performSignOut()} className="w-full">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
