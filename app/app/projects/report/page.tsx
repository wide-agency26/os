"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { NativeCharts } from "@/components/reports/NativeCharts";
import { BarChart3, Database } from "lucide-react";
import Link from "next/link";

const CATEGORIES = ["General", "Social", "Digital", "Website", "Content"];

export default function CentralReportHub() {
  const [role, setRole] = useState<string>("client");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("General");
  
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(false);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      let userRole = "client";
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
        
      if (profile) {
        userRole = profile.role;
        setRole(profile.role);
      }

      // Load Projects
      let projectQuery = supabase.from("projects").select("id, title").order("title");
      if (userRole === "client") {
        projectQuery = projectQuery.eq("client_id", user.id);
      }
      
      const { data: projData } = await (projectQuery as any);
      if (projData && projData.length > 0) {
        setProjects(projData);
        setSelectedProjectId(projData[0].id);
      } else {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedProjectId || !selectedCategory) return;
    loadReportData(selectedProjectId, selectedCategory);
  }, [selectedProjectId, selectedCategory]);

  async function loadReportData(projectId: string, category: string) {
    setLoading(true);
    setPublished(false);
    
    // Check if published
    const { data: report } = await (supabase as any)
      .from("published_reports")
      .select("id")
      .eq("project_id", projectId)
      .eq("category", category)
      .maybeSingle();
    
    if (report) {
      setPublished(true);
    }

    // Load metrics
    const { data: metricData } = await (supabase as any)
      .from("marketing_metrics")
      .select("*")
      .eq("project_id", projectId)
      .eq("category", category)
      .order("date", { ascending: true });
      
    setMetrics(metricData || []);
    setLoading(false);
  }

  const handlePublish = async () => {
    if (!selectedProjectId) return;
    
    const { error } = await (supabase as any)
      .from("published_reports")
      .upsert({
        project_id: selectedProjectId,
        category: selectedCategory,
        config: { version: "1.0", charts: ["funnel", "trends"] }
      }, { onConflict: "project_id, category" });
      
    if (error) {
      alert("Error publishing report: " + error.message);
    } else {
      setPublished(true);
      alert("Report published successfully!");
    }
  };

  const isAdmin = role === "admin" || role === "superadmin";

  return (
    <Workspace>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Report Hub</h2>
            <p className="text-gray-500 text-[13px]">
              {isAdmin ? "Build and publish project reports." : "View your project reports."}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <Link 
            href="/app/projects/report-data"
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-[13px] hover:bg-gray-50"
          >
            <Database size={14} />
            Manage Data Hub
          </Link>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex items-end gap-4">
        <div className="flex-1 max-w-sm">
          <label className="block text-[12px] font-medium text-gray-700 mb-1">Select Project</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {projects.length === 0 && <option value="">No projects found...</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <div className="flex-1 max-w-sm">
          <label className="block text-[12px] font-medium text-gray-700 mb-1">Report Purpose</label>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        {isAdmin && selectedProjectId && (
          <div className="ml-auto">
            <button 
              onClick={handlePublish}
              className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700"
            >
              {published ? "Update Published Report" : "Publish Report"}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-[13px] text-gray-500">Loading report data...</div>
      ) : !selectedProjectId ? (
        <div className="p-12 text-center text-[13px] text-gray-500">Please select a project to view reports.</div>
      ) : isAdmin ? (
        metrics.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-gray-300 rounded-lg bg-gray-50">
            <p className="text-[13px] text-gray-500 mb-2">No metrics found for {selectedCategory} in this project.</p>
            <Link href="/app/projects/report-data" className="text-[13px] text-blue-600 hover:underline">
               Upload CSV data to get started
            </Link>
          </div>
        ) : (
          <Section title={`${selectedCategory} Report Preview`}>
            <NativeCharts data={metrics} />
          </Section>
        )
      ) : (
        // Client View
        !published ? (
          <div className="p-12 text-center border border-dashed border-gray-300 rounded-lg bg-gray-50">
            <p className="text-[13px] text-gray-500">Your {selectedCategory} report is currently being prepared. Check back soon!</p>
          </div>
        ) : (
          <Section title={`${selectedCategory} Report`}>
            <NativeCharts data={metrics} />
          </Section>
        )
      )}
    </Workspace>
  );
}
