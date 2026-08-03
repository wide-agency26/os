"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { NativeCharts } from "@/components/reports/NativeCharts";
import { BarChart3, AlertCircle } from "lucide-react";

export default function ClientReportViewer() {
  const { clientId } = useParams();
  const [metricData, setMetricData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadReport() {
      if (!clientId) return;
      
      try {
        // 1. Verify a published report exists for this client
        const { data: published, error: pubErr } = await (supabase as any)
          .from("published_reports")
          .select("*")
          .eq("client_id", clientId)
          .single();
          
        if (pubErr || !published) {
          throw new Error("No reports have been published for your account yet.");
        }
        
        // 2. Fetch the raw marketing metrics
        const { data: metrics, error: metricsErr } = await (supabase as any)
          .from("marketing_metrics")
          .select("*")
          .eq("client_id", clientId)
          .order("date", { ascending: true });
          
        if (metricsErr) throw metricsErr;
        
        setMetricData(metrics || []);
      } catch (err: any) {
        setError(err.message || "Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    
    loadReport();
  }, [clientId]);

  if (loading) {
    return (
      <Workspace>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Workspace>
    );
  }

  if (error) {
    return (
      <Workspace>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Report Unavailable</h2>
          <p className="text-gray-500 text-[14px] max-w-md text-center">{error}</p>
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
          <BarChart3 size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Performance Report</h2>
          <p className="text-gray-500 text-[13px]">
            Your latest marketing analytics and pipeline data.
          </p>
        </div>
      </div>
      
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 min-h-[500px]">
        <NativeCharts data={metricData} />
      </div>
    </Workspace>
  );
}
