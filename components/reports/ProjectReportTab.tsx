"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { NativeCharts } from "./NativeCharts";
import { Section } from "@/components/frappe-ui/Workspace";

export function ProjectReportTab({ projectId }: { projectId: string }) {
  const [role, setRole] = useState<string>("client");
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      
      // Get role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile) setRole(profile.role);
      }

      // Check if published
      const { data: report } = await supabase
        .from("published_reports")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();
      
      if (report) {
        setPublished(true);
      }

      // Load metrics
      const { data: metricData } = await supabase
        .from("marketing_metrics")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: true });
        
      if (metricData) {
        setMetrics(metricData);
      }
      setLoading(false);
    }
    loadData();
  }, [projectId]);

  const handlePublish = async () => {
    const supabase = createClient();
    const { error } = await supabase
      .from("published_reports")
      .upsert({
        project_id: projectId,
        config: { version: "1.0", charts: ["funnel", "trends"] }
      });
      
    if (error) {
      alert("Error publishing report: " + error.message);
    } else {
      setPublished(true);
      alert("Report published successfully!");
    }
  };

  if (loading) {
    return <div className="p-4 text-[13px] text-gray-500">Loading reports...</div>;
  }

  if (role === "admin" || role === "superadmin") {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Native Report Builder</h2>
            <p className="text-[13px] text-gray-500">Preview how this report looks before publishing.</p>
          </div>
          <button 
            onClick={handlePublish}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700"
          >
            {published ? "Update Published Report" : "Publish Report"}
          </button>
        </div>

        {metrics.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-300 rounded-lg">
            <p className="text-[13px] text-gray-500 mb-2">No metrics found for this project.</p>
            <p className="text-[13px] text-blue-600 hover:underline cursor-pointer">
               Go to Data Hub to upload CSV data.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg bg-gray-50">
            <NativeCharts data={metrics} />
          </div>
        )}
      </div>
    );
  }

  // Client View
  if (!published) {
    return (
      <div className="p-8 text-center border border-dashed border-gray-300 rounded-lg">
        <p className="text-[13px] text-gray-500">Your report is currently being prepared. Check back soon!</p>
      </div>
    );
  }

  return (
    <Section title="Project Dashboard">
      <NativeCharts data={metrics} />
    </Section>
  );
}
