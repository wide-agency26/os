"use client";

import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { AwaitingEmailCard } from "./AwaitingEmailCard";
import { CompanyPickerModal } from "./CompanyPickerModal";
import { PendingAccessCard } from "./PendingAccessCard";
import { RejectedAccessCard } from "./RejectedAccessCard";
import {
  loadClientAccessSnapshot,
  type ClientAccessFlowState,
} from "@/app/actions/client-access";

interface ClientAccessFlowGateProps {
  children: React.ReactNode;
}

export function ClientAccessFlowGate({ children }: ClientAccessFlowGateProps) {
  const [flowState, setFlowState] = useState<ClientAccessFlowState | "loading">("loading");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [companyName, setCompanyName] = useState("your organization");

  async function evaluateState() {
    setFlowState("loading");
    try {
      const snap = await loadClientAccessSnapshot();
      setUserId(snap.userId);
      setUserEmail(snap.userEmail);
      setCompanyName(snap.companyName);
      setFlowState(snap.state);
    } catch (err) {
      console.error("Error in ClientAccessFlowGate:", err);
      setFlowState("no_company");
    }
  }

  useEffect(() => {
    void evaluateState();
  }, []);

  if (flowState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-var(--os-header))]">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  if (flowState === "unverified") {
    return <AwaitingEmailCard email={userEmail} />;
  }

  if (flowState === "no_company") {
    return (
      <CompanyPickerModal
        userId={userId}
        onResolved={(next) => {
          setCompanyName(next.companyName);
          setFlowState(next.state);
        }}
      />
    );
  }

  if (flowState === "pending") {
    return <PendingAccessCard companyName={companyName} />;
  }

  if (flowState === "rejected") {
    return (
      <RejectedAccessCard
        companyName={companyName}
        onSelectDifferentCompany={() => setFlowState("no_company")}
      />
    );
  }

  return <>{children}</>;
}
