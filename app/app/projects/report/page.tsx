"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { NativeCharts } from "@/components/reports/NativeCharts";
import { BarChart3, Database, FileSpreadsheet, Loader2 } from "lucide-react";
import Link from "next/link";
import { type ColumnSchema } from "@/lib/data-hub/column-detector";

const CATEGORIES = ["General", "Social", "Digital", "Website", "Content"];

interface DatasetInfo {
  id: string;
  name: string;
  category: string;
  columns: ColumnSchema[];
  row_count: number;
}

export default function CentralReportHub() {
  const [role, setRole] = useState<string>("client");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("General");

  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [datasetRows, setDatasetRows] = useState<Record<string, any>[]>([]);
  const [datasetColumns, setDatasetColumns] = useState<ColumnSchema[]>([]);

  // Legacy marketing_metrics support
  const [legacyMetrics, setLegacyMetrics] = useState<any[]>([]);

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

  // Load datasets when project or category changes
  useEffect(() => {
    if (!selectedProjectId) return;
    loadProjectData(selectedProjectId, selectedCategory);
  }, [selectedProjectId, selectedCategory]);

  async function loadProjectData(projectId: string, category: string) {
    setLoading(true);
    setPublished(false);
    setDatasetRows([]);
    setDatasetColumns([]);
    setSelectedDatasetId("");
    setLegacyMetrics([]);

    // 1. Check for datasets
    const { data: ds } = await (supabase as any)
      .from("datasets")
      .select("id, name, category, columns, row_count")
      .eq("project_id", projectId)
      .eq("category", category)
      .order("created_at", { ascending: false });

    if (ds && ds.length > 0) {
      setDatasets(ds);
      // Auto-select the first dataset
      setSelectedDatasetId(ds[0].id);
      await loadDatasetRows(ds[0].id, ds[0].columns);
    } else {
      setDatasets([]);
      // Fallback: try legacy marketing_metrics
      const { data: metricData } = await (supabase as any)
        .from("marketing_metrics")
        .select("*")
        .eq("project_id", projectId)
        .eq("category", category)
        .order("date", { ascending: true });
      setLegacyMetrics(metricData || []);
    }

    // Check published status
    const { data: report } = await (supabase as any)
      .from("published_reports")
      .select("id")
      .eq("project_id", projectId)
      .eq("category", category)
      .maybeSingle();
    if (report) setPublished(true);

    setLoading(false);
  }

  async function loadDatasetRows(datasetId: string, columns: ColumnSchema[]) {
    const { data: rows } = await (supabase as any)
      .from("dataset_rows")
      .select("row_data")
      .eq("dataset_id", datasetId)
      .order("row_index");

    setDatasetColumns(columns);
    setDatasetRows(rows?.map((r: any) => r.row_data) || []);
  }

  const handleDatasetChange = async (dsId: string) => {
    setSelectedDatasetId(dsId);
    const ds = datasets.find((d) => d.id === dsId);
    if (ds) {
      await loadDatasetRows(ds.id, ds.columns);
    }
  };

  const handlePublish = async () => {
    if (!selectedProjectId) return;

    const { error } = await (supabase as any)
      .from("published_reports")
      .upsert(
        {
          project_id: selectedProjectId,
          category: selectedCategory,
          config: { version: "2.0", dataset_id: selectedDatasetId || null },
        },
        { onConflict: "project_id, category" }
      );

    if (error) {
      alert("Error publishing report: " + error.message);
    } else {
      setPublished(true);
      alert("Report published successfully!");
    }
  };

  const isAdmin = role === "admin" || role === "superadmin";
  const hasData = datasetRows.length > 0 || legacyMetrics.length > 0;

  return (
    <Workspace>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
            <p className="text-gray-500 text-[13px]">
              {isAdmin
                ? "Build, preview, and publish project reports."
                : "View your project reports."}
            </p>
          </div>
        </div>

        {isAdmin && (
          <Link
            href="/app/projects/report-data"
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[13px] hover:bg-gray-50 transition-colors"
          >
            <Database size={14} />
            Data Hub
          </Link>
        )}
      </div>

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[12px] font-medium text-gray-600 mb-1">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {projects.length === 0 && (
                <option value="">No projects found...</option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[12px] font-medium text-gray-600 mb-1">
              Purpose
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Dataset selector (if multiple datasets) */}
          {datasets.length > 1 && (
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[12px] font-medium text-gray-600 mb-1">
                Dataset
              </label>
              <select
                value={selectedDatasetId}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
          )}

          {isAdmin && selectedProjectId && (
            <button
              onClick={handlePublish}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-[13px] font-medium hover:from-blue-700 hover:to-indigo-700 shadow-sm whitespace-nowrap"
            >
              {published ? "Update Report" : "Publish Report"}
            </button>
          )}
        </div>

        {/* Dataset info badge */}
        {datasets.length > 0 && selectedDatasetId && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-gray-500">
            <FileSpreadsheet size={13} className="text-indigo-500" />
            <span>
              Showing <strong className="text-gray-700">{datasetRows.length}</strong> rows from{" "}
              <strong className="text-gray-700">{datasets.find((d) => d.id === selectedDatasetId)?.name}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="p-16 text-center text-[13px] text-gray-500">
          <Loader2 className="animate-spin mx-auto mb-2" size={20} />
          Loading report data...
        </div>
      ) : !selectedProjectId ? (
        <div className="p-16 text-center text-[13px] text-gray-500">
          Please select a project to view reports.
        </div>
      ) : isAdmin ? (
        !hasData ? (
          <div className="p-16 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
            <FileSpreadsheet className="mx-auto mb-3 text-gray-400" size={32} />
            <p className="text-[14px] text-gray-600 font-medium mb-1">
              No data for {selectedCategory}
            </p>
            <p className="text-[12px] text-gray-500 mb-3">
              Upload a CSV in the Data Hub to generate charts automatically.
            </p>
            <Link
              href="/app/projects/report-data"
              className="text-[13px] text-blue-600 hover:underline font-medium"
            >
              Open Data Hub →
            </Link>
          </div>
        ) : (
          <Section title={`${selectedCategory} Report Preview`}>
            <NativeCharts
              columns={datasetColumns.length > 0 ? datasetColumns : undefined}
              rows={datasetRows.length > 0 ? datasetRows : undefined}
              data={legacyMetrics.length > 0 ? legacyMetrics : undefined}
            />
          </Section>
        )
      ) : !published ? (
        <div className="p-16 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
          <p className="text-[14px] text-gray-600 font-medium">
            Your {selectedCategory} report is being prepared.
          </p>
          <p className="text-[12px] text-gray-500 mt-1">Check back soon!</p>
        </div>
      ) : (
        <Section title={`${selectedCategory} Report`}>
          <NativeCharts
            columns={datasetColumns.length > 0 ? datasetColumns : undefined}
            rows={datasetRows.length > 0 ? datasetRows : undefined}
            data={legacyMetrics.length > 0 ? legacyMetrics : undefined}
          />
        </Section>
      )}
    </Workspace>
  );
}
