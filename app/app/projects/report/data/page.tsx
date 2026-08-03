"use client";

import { useState, useEffect, useRef } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { Upload, Trash, Loader2, Database, AlertCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Papa from "papaparse";
import Link from "next/link";

interface MetricRow {
  id: string;
  client_id: string;
  date: string;
  stage: string;
  metric_name: string;
  metric_value: number;
  profiles: { full_name: string };
}

export default function ReportDataHub() {
  const [data, setData] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, full_name")
      .eq("role", "client")
      .order("full_name");
    
    if (profiles) {
      setClients(profiles);
      if (profiles.length > 0) setSelectedClientId(profiles[0].id);
    }
  }

  async function fetchData() {
    setLoading(true);
    const { data: metrics, error } = await (supabase as any)
      .from("marketing_metrics")
      .select(`
        id, client_id, date, stage, metric_name, metric_value,
        profiles ( full_name )
      `)
      .order("date", { ascending: false });

    if (error) {
      console.error("Failed to fetch data", error);
    } else {
      setData(metrics || []);
    }
    setLoading(false);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedClientId) {
      setError("Please select a client before uploading.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data.map((row: any) => ({
            client_id: selectedClientId,
            date: row.date || row.Date,
            stage: row.stage || row.Stage,
            metric_name: row.metric_name || row.Metric || row['Metric Name'],
            metric_value: parseFloat(row.metric_value || row.Value || 0)
          }));

          // Validate rows
          const invalid = rows.find(r => !r.date || !r.stage || !r.metric_name || isNaN(r.metric_value));
          if (invalid) {
            throw new Error("Invalid CSV format. Ensure columns: date, stage, metric_name, metric_value exist.");
          }

          const { error: upsertErr } = await (supabase as any)
            .from("marketing_metrics")
            .upsert(rows, { onConflict: "client_id, date, stage, metric_name" });

          if (upsertErr) throw upsertErr;

          setSuccess(`Successfully uploaded ${rows.length} rows.`);
          fetchData();
        } catch (err: any) {
          setError(err.message || "Failed to process CSV.");
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
      error: (err) => {
        setError(err.message);
        setUploading(false);
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    await (supabase as any).from("marketing_metrics").delete().eq("id", id);
    fetchData();
  };

  return (
    <Workspace>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Data Hub</h2>
            <p className="text-gray-500 text-[13px]">Ingest and manage raw marketing data.</p>
          </div>
        </div>
        <Link 
          href="/app/projects/report"
          className="text-[13px] text-blue-600 font-medium hover:underline"
        >
          &larr; Back to Report Builder
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Upload size={16} /> Upload CSV
            </h3>

            <div className="mb-4">
              <label className="block text-[12px] font-medium text-gray-700 mb-1">
                Target Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
              <input 
                type="file" 
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden" 
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                {uploading ? (
                  <Loader2 className="animate-spin text-blue-600 mb-2" size={24} />
                ) : (
                  <Upload className="text-gray-400 mb-2" size={24} />
                )}
                <span className="text-[13px] font-medium text-gray-700">
                  {uploading ? "Uploading..." : "Click to select CSV"}
                </span>
                <span className="text-[11px] text-gray-500 mt-1 text-center">
                  Columns: date, stage, metric_name, metric_value
                </span>
              </label>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-600 rounded text-[13px] flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded text-[13px]">
                {success}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-[14px]">Ingested Data</h3>
              <span className="text-[12px] text-gray-500">{data.length} records</span>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white sticky top-0 border-b border-gray-200 shadow-sm z-10">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-500">Client</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Stage</th>
                    <th className="px-4 py-3 font-medium text-gray-500">Metric</th>
                    <th className="px-4 py-3 font-medium text-gray-500 text-right">Value</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td></tr>
                  ) : data.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">No data found. Upload a CSV to get started.</td></tr>
                  ) : (
                    data.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900 font-medium">{row.profiles?.full_name}</td>
                        <td className="px-4 py-2 text-gray-600">{row.date}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] font-semibold">
                            {row.stage}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{row.metric_name}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          {row.metric_value.toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <button 
                            onClick={() => handleDelete(row.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Workspace>
  );
}
