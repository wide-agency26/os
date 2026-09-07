"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";
import { CiCanvasApp } from "@/components/ci-builder/canvas/CiCanvasApp";

export default function CIBuilderPage() {
  const params = useParams();
  const projectId = params.project_id as string;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile && isFounder(profile.role)) setIsAdmin(true);
      setLoading(false);
    }
    void checkAuth();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading CI Builder...</div>;
  }

  if (!isAdmin) {
    return <div className="p-8 text-center text-red-500">Access Denied. Admins only.</div>;
  }

  return <CiCanvasApp projectId={projectId} />;
}
