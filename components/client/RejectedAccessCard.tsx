"use client";

import React from "react";
import { Building2, LogOut } from "lucide-react";
import { performSignOut } from "@/lib/auth/sign-out";
import { Button } from "@/components/frappe-ui/primitives";

interface RejectedAccessCardProps {
  companyName: string;
  onSelectDifferentCompany: () => void;
}

export function RejectedAccessCard({
  companyName,
  onSelectDifferentCompany,
}: RejectedAccessCardProps) {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-lg border border-border p-8 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-800 mb-2">
          Request not approved
        </p>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Access not granted</h1>
        <p className="text-[13px] text-text-secondary leading-relaxed mb-6">
          Your request to access work for{" "}
          <strong className="text-text-primary font-medium">{companyName}</strong> was not
          approved. Contact your account manager, or request a different organization.
        </p>
        <div className="space-y-2">
          <Button onClick={onSelectDifferentCompany} className="w-full">
            <Building2 className="w-4 h-4" />
            Request a different company
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
