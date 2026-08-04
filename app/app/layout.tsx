"use client";

import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "@/components/frappe-ui/Sidebar";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { Awesomebar } from "@/components/frappe-ui/Awesomebar";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [isStaff, setIsStaff] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkRole() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsStaff(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile && isFounder(profile.role)) {
          setIsStaff(true);
        } else {
          setIsStaff(false);
        }
      } catch {
        setIsStaff(false);
      }
    }
    checkRole();
  }, []);

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      {isStaff === true ? (
        <Sidebar />
      ) : isStaff === false ? (
        <ClientSidebar />
      ) : (
        <div className="w-[240px] bg-[#F9FAFB] border-r border-[#E5E7EB] h-screen animate-pulse" />
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Awesomebar title={isStaff ? "WIDE OS Workspace" : "WIDE Client Portal"} />
        {children}
      </div>
    </div>
  );
}
