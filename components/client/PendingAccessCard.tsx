"use client";

import React from "react";
import { Clock, LogOut } from "lucide-react";
import { performSignOut } from "@/lib/auth/sign-out";
import { Button } from "@/components/frappe-ui/primitives";

interface PendingAccessCardProps {
  companyName: string;
}

export function PendingAccessCard({ companyName }: PendingAccessCardProps) {
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-lg border border-border p-8 text-center">
        <Clock className="w-6 h-6 text-text-primary mx-auto mb-4" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 mb-2">
          Pending approval
        </p>
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          Access request under review
        </h1>
        <p className="text-[13px] text-text-secondary leading-relaxed mb-6">
          Your request to access work for{" "}
          <strong className="text-text-primary font-medium">{companyName}</strong> is waiting
          on a WIDE administrator.
        </p>
        <div className="bg-surface-raised border border-border rounded-lg p-4 text-[13px] text-text-secondary text-left mb-6">
          Access is verified before brand files and reports are shown.
        </div>
        <Button variant="secondary" onClick={() => void performSignOut()} className="w-full">
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
