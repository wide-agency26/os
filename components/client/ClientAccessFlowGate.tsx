"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import { AwaitingEmailCard } from "./AwaitingEmailCard";
import { CompanyPickerModal } from "./CompanyPickerModal";
import { PendingAccessCard } from "./PendingAccessCard";
import { RejectedAccessCard } from "./RejectedAccessCard";
import { isFounder } from "@/lib/rbac";

export type FlowState = "loading" | "unverified" | "no_company" | "pending" | "rejected" | "active";

interface ClientAccessFlowGateProps {
  children: React.ReactNode;
}

export function ClientAccessFlowGate({ children }: ClientAccessFlowGateProps) {
  const [flowState, setFlowState] = useState<FlowState>("loading");
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("your organization");

  const evaluateState = async () => {
    setFlowState("loading");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setFlowState("loading");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");

      // 1. Staff override
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && isFounder(profile.role)) {
        setFlowState("active");
        return;
      }

      // 2. Email verification check
      if (user.email_confirmed_at === null && user.app_metadata?.provider === "email") {
        setFlowState("unverified");
        return;
      }

      // 3. Fetch company_members
      const { data: members, error: memErr } = await (supabase as any)
        .from("company_members")
        .select("company_id, status, crm_customers(company, name)")
        .eq("user_id", user.id);

      if (memErr) {
        console.error("Error fetching company members:", memErr);
      }

      if (!members || members.length === 0) {
        setFlowState("no_company");
        return;
      }

      // Priority check: active > pending > rejected
      const activeMember = members.find((m: any) => m.status === "active");
      if (activeMember) {
        setFlowState("active");
        return;
      }

      const pendingMember = members.find((m: any) => m.status === "pending");
      if (pendingMember) {
        const cust = pendingMember.crm_customers;
        setCompanyName(cust?.company || cust?.name || "your organization");
        setFlowState("pending");
        return;
      }

      const rejectedMember = members.find((m: any) => m.status === "rejected");
      if (rejectedMember) {
        const cust = rejectedMember.crm_customers;
        setCompanyName(cust?.company || cust?.name || "your organization");
        setFlowState("rejected");
        return;
      }

      setFlowState("no_company");
    } catch (err) {
      console.error("Error in ClientAccessFlowGate:", err);
      setFlowState("no_company");
    }
  };

  useEffect(() => {
    evaluateState();
  }, []);

  if (flowState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
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
        onRequestSubmitted={(name) => {
          setCompanyName(name);
          setFlowState("pending");
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
