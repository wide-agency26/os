"use client";

import { useState, useEffect } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { LayoutDashboard, ExternalLink, Loader2, Plus, RefreshCw, BarChart3 } from "lucide-react";
import Link from "next/link";

interface Template {
  id: number;
  dashboard_title: string;
  slug: string | null;
  url: string;
  status: string;
  published: boolean;
}

export default function ReportTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/reports/templates");
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch templates");
      }
      
      setTemplates(data.dashboards || []);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch templates:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTemplates();
  };

  const supersetUrl = process.env.NEXT_PUBLIC_SUPERSET_URL;

  return (
    <Workspace>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center text-white shadow-md">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Report Templates</h2>
            <p className="text-gray-500 text-[13px]">
              Master dashboard templates pulled directly from Apache Superset.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Refresh templates from Superset"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
          
          {supersetUrl ? (
            <a 
              href={`${supersetUrl}/dashboard/list/`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white font-medium text-[13px] rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              New Template in Superset
            </a>
          ) : (
            <button 
              disabled
              className="px-4 py-2 bg-gray-300 text-gray-500 font-medium text-[13px] rounded-lg cursor-not-allowed flex items-center gap-2"
              title="Configure NEXT_PUBLIC_SUPERSET_URL to enable this button"
            >
              <Plus size={16} />
              New Template in Superset
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-[14px]">Fetching templates from Superset...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center max-w-2xl mx-auto mt-8">
          <div className="text-red-600 font-semibold text-[15px] mb-2">Connection Error</div>
          <p className="text-red-500 text-[13px] mb-6">{error}</p>
          <div className="bg-white/60 p-4 rounded-lg text-left border border-red-100 text-[12px] text-gray-600 space-y-2">
            <p className="font-medium">Please ensure:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Your Apache Superset instance is running and accessible</li>
              <li>You have configured <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">SUPERSET_URL</code> in your environment variables</li>
              <li>You have configured <code className="bg-white px-1.5 py-0.5 rounded border border-gray-200">SUPERSET_ADMIN_USER</code> and password</li>
              <li>The API user has permission to list and copy dashboards</li>
            </ol>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center max-w-3xl mx-auto mt-8">
          <LayoutDashboard size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-gray-900 font-semibold text-[16px] mb-2">No Templates Found</h3>
          <p className="text-gray-500 text-[13px] mb-6 max-w-md mx-auto">
            You don't have any dashboards in Superset yet, or the API user doesn't have access to them.
          </p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-left mb-6">
            <h4 className="font-medium text-[13px] text-gray-800 mb-2 flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-500" />
              How to create a Master Template
            </h4>
            <ol className="list-decimal pl-5 text-[12px] text-gray-600 space-y-2">
              <li>Open your Apache Superset instance</li>
              <li>Create a new dashboard with the required charts (e.g., Awareness, Consideration, Conversion funnels)</li>
              <li>Save and publish the dashboard</li>
              <li>Return here and click refresh to see it appear as a template</li>
            </ol>
          </div>
          
          {supersetUrl && (
            <a 
              href={`${supersetUrl}/dashboard/new/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white font-medium text-[13px] rounded-lg hover:bg-gray-800 transition-colors"
            >
              Open Superset
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((template) => (
            <div key={template.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
              <div className="h-32 bg-gray-50 border-b border-gray-100 flex items-center justify-center p-6 relative">
                <BarChart3 size={40} className="text-gray-200 group-hover:text-blue-100 transition-colors" />
                
                {template.published && (
                  <span className="absolute top-3 right-3 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    PUBLISHED
                  </span>
                )}
                {!template.published && (
                  <span className="absolute top-3 right-3 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    DRAFT
                  </span>
                )}
              </div>
              
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 text-[15px] truncate mb-1" title={template.dashboard_title}>
                  {template.dashboard_title}
                </h3>
                <div className="flex items-center gap-4 text-[12px] text-gray-500 mb-4">
                  <span>ID: {template.id}</span>
                  {template.slug && <span className="truncate max-w-[120px]">Slug: {template.slug}</span>}
                </div>
                
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <Link 
                    href="/app/projects/report"
                    className="text-[12px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Use as template
                  </Link>
                  
                  {supersetUrl && (
                    <a 
                      href={`${supersetUrl}${template.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-900 transition-colors"
                      title="Edit template in Superset"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Workspace>
  );
}
