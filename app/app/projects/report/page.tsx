"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { BarChart3, Database, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { NativeCharts } from "@/components/reports/NativeCharts";

interface ClientEntry {
  id: string;
  full_name: string;
  company_name: string | null;
}

export default function NativeReportBuilder() {
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [metricData, setMetricData] = useState<any[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchClients() {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, company_name")
        .eq("role", "client")
        .order("full_name");
        
      setClients(profiles || []);
      setLoading(false);
    }
    fetchClients();
  }, []);

  useEffect(() => {
    async function loadClientData() {
      if (!selectedClientId) {
        setMetricData([]);
        return;
      }
      
      const { data } = await (supabase as any)
        .from("marketing_metrics")
        .select("*")
        .eq("client_id", selectedClientId)
        .order("date", { ascending: true });
        
      setMetricData(data || []);
      setPublishStatus(null);
    }
    
    loadClientData();
  }, [selectedClientId]);

  const handlePublish = async () => {
    if (!selectedClientId) return;
    setIsPublishing(true);
    setPublishStatus(null);
    
    try {
      // Upsert into published_reports
      const { error } = await (supabase as any)
        .from("published_reports")
        .upsert({
          client_id: selectedClientId,
          config: { theme: 'light', layout: 'default' },
          published_at: new Date().toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        }, { onConflict: 'client_id' });
        
      if (error) throw error;
      
      setPublishStatus({ type: 'success', msg: 'Report successfully published to client portal.' });
    } catch (err: any) {
      setPublishStatus({ type: 'error', msg: err.message || 'Failed to publish report.' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Workspace>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Report Builder</h2>
            <p className="text-gray-500 text-[13px]">
              Preview and publish native dashboards to clients.
            </p>
          </div>
        </div>
        
        <Link 
          href="/app/projects/report/data"
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Database size={16} />
          Manage Data Hub
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4 text-[14px]">Configuration</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                  Select Client
                </label>
                {loading ? (
                  <div className="h-9 bg-gray-100 animate-pulse rounded"></div>
                ) : (
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- Choose Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {selectedClientId && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="bg-blue-50 p-3 rounded-lg mb-4 border border-blue-100">
                    <p className="text-blue-800 text-[12px] font-medium mb-1">Data Status</p>
                    <p className="text-blue-600 text-[12px]">
                      {metricData.length} records found for this client.
                    </p>
                  </div>
                  
                  <button
                    onClick={handlePublish}
                    disabled={isPublishing || metricData.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                    {isPublishing ? "Publishing..." : "Publish to Client"}
                  </button>
                  
                  {publishStatus && (
                    <div className={`mt-3 p-2.5 rounded flex items-start gap-2 text-[12px] ${publishStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {publishStatus.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                      <span>{publishStatus.msg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-3">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900 text-[15px]">Live Preview</h3>
              <span className="px-2.5 py-1 bg-white border border-gray-200 text-gray-500 rounded-full text-[11px] font-medium uppercase tracking-wider">
                Client View
              </span>
            </div>
            
            {!selectedClientId ? (
              <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-gray-200 rounded-xl bg-white">
                <BarChart3 className="text-gray-300 mb-3" size={32} />
                <p className="text-gray-500 font-medium text-[14px]">Select a client to preview their report</p>
              </div>
            ) : (
              <NativeCharts data={metricData} />
            )}
          </div>
        </div>
      </div>
    </Workspace>
  );
}
