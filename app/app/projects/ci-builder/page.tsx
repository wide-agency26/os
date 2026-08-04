"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { AdminEditor } from "@/components/ci-builder/AdminEditor";
import { Loader2 } from "lucide-react";

import { isFounder } from "@/lib/rbac";

export default function CIBuilderHub() {
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadInitialData() {
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

      console.log("[CI Builder Debug] User ID:", user.id);
      console.log("[CI Builder Debug] Profile Role:", profile?.role);
      console.log("[CI Builder Debug] isFounder:", isFounder(profile?.role));

      if (profile && isFounder(profile.role)) {
        setIsAdmin(true);
        
        // Fetch projects
        const { data: projData, error: projErr } = await (supabase as any)
          .from("projects")
          .select("id, title")
          .order("title");
          
        console.log("[CI Builder Debug] Projects Query Error:", projErr);
        console.log("[CI Builder Debug] Projects Query Count:", projData?.length ?? 0);
        console.log("[CI Builder Debug] Projects Query Data:", projData);

        if (projErr) {
          console.error("Error loading projects for CI Builder:", projErr);
        } else if (projData && projData.length > 0) {
          setProjects(projData);
          setSelectedProjectId(projData[0].id);
        }
      }
      setLoading(false);
    }
    loadInitialData();
  }, []);

  if (loading) {
    return (
      <Workspace>
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Workspace>
    );
  }

  if (!isAdmin) {
    return (
      <Workspace>
        <div className="p-8 text-center text-red-500 font-medium">
          Access Denied. Only admins can access the Brand Guideline Builder.
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <div className="flex flex-col h-[calc(100vh-64px)] -m-6">
        {/* Header / Project Selector */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm z-10 shrink-0">
          <h1 className="text-lg font-semibold text-gray-800">Brand Guideline Builder</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500">Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-64 bg-gray-50"
            >
              {projects.length === 0 && <option value="">No projects found</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-hidden">
          {selectedProjectId ? (
            <AdminEditor projectId={selectedProjectId} />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Select a project to begin
            </div>
          )}
        </div>
      </div>
    </Workspace>
  );
}
