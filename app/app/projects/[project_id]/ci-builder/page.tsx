"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { AdminEditor } from "@/components/ci-builder/AdminEditor";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";

export default function CIBuilderPage() {
  const params = useParams();
  const projectId = params.project_id as string;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profile && isFounder(profile.role)) {
        setIsAdmin(true);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return <Workspace><div className="p-8 text-center">Loading CI Builder...</div></Workspace>;
  }

  if (!isAdmin) {
    return <Workspace><div className="p-8 text-center text-red-500">Access Denied. Admins only.</div></Workspace>;
  }

  return (
    <Workspace>
      <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
        {/* Full bleed editor within the workspace */}
        <AdminEditor projectId={projectId} />
      </div>
    </Workspace>
  );
}
