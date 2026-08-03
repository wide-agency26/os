"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Upload, Trash2, Loader2, Database, AlertCircle, CheckCircle2,
  FileSpreadsheet, ChevronRight, ChevronLeft, Eye, EyeOff, X,
  BarChart3, ArrowUpDown, Search, Layers
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Papa from "papaparse";
import Link from "next/link";
import {
  detectColumns,
  TYPE_BADGES,
  type ColumnSchema,
  type ColumnType,
  type DetectionResult,
} from "@/lib/data-hub/column-detector";

const CATEGORIES = ["General", "Social", "Digital", "Website", "Content"];

interface DatasetMeta {
  id: string;
  project_id: string;
  name: string;
  category: string;
  columns: ColumnSchema[];
  row_count: number;
  created_at: string;
  projects?: { title: string };
}

// ═══════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════
export default function DataHubPage() {
  const supabase = createClient();

  // Page-level state
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, any>[]>([]);
  const [searchFilter, setSearchFilter] = useState("");

  // Wizard state
  const [wizardStep, setWizardStep] = useState(0); // 0 = closed, 1/2/3 = steps
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("General");
  const [datasetName, setDatasetName] = useState("");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<ColumnSchema[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load data on mount ───────────────────────────────────────────
  useEffect(() => {
    fetchProjects();
    fetchDatasets();
  }, []);

  async function fetchProjects() {
    const { data } = await (supabase as any)
      .from("projects")
      .select("id, title")
      .order("title");
    if (data) {
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) setSelectedProjectId(data[0].id);
    }
  }

  async function fetchDatasets() {
    setLoadingDatasets(true);
    const { data, error } = await (supabase as any)
      .from("datasets")
      .select("id, project_id, name, category, columns, row_count, created_at, projects ( title )")
      .order("created_at", { ascending: false });
    if (!error && data) setDatasets(data);
    setLoadingDatasets(false);
  }

  async function loadDatasetRows(datasetId: string) {
    if (expandedDatasetId === datasetId) {
      setExpandedDatasetId(null);
      return;
    }
    const { data } = await (supabase as any)
      .from("dataset_rows")
      .select("row_data, row_index")
      .eq("dataset_id", datasetId)
      .order("row_index")
      .limit(100);
    setExpandedRows(data?.map((r: any) => r.row_data) || []);
    setExpandedDatasetId(datasetId);
  }

  async function deleteDataset(id: string) {
    if (!confirm("Delete this dataset and all its rows?")) return;
    await (supabase as any).from("datasets").delete().eq("id", id);
    if (expandedDatasetId === id) setExpandedDatasetId(null);
    fetchDatasets();
  }

  // ── File handling ────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setError(null);
    setSuccess(null);
    setDatasetName(file.name.replace(/\.(csv|tsv|txt)$/i, ""));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setError("CSV file appears to be empty.");
          return;
        }
        const result = detectColumns(results.data as Record<string, string>[]);
        setDetection(result);
        setColumnOverrides([...result.columns]);
        setWizardStep(2);
      },
      error: (err) => {
        setError("Failed to parse file: " + err.message);
      },
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWizardStep(1);
      processFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".tsv") || file.name.endsWith(".txt"))) {
      setWizardStep(1);
      processFile(file);
    } else {
      setError("Please drop a CSV or TSV file.");
    }
  }, [processFile]);

  // ── Column overrides ────────────────────────────────────────────
  const toggleColumnIgnore = (key: string) => {
    setColumnOverrides((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ignored: !c.ignored } : c))
    );
  };

  const updateColumnType = (key: string, newType: ColumnType) => {
    setColumnOverrides((prev) =>
      prev.map((c) => (c.key === key ? { ...c, type: newType } : c))
    );
  };

  const updateColumnLabel = (key: string, newLabel: string) => {
    setColumnOverrides((prev) =>
      prev.map((c) => (c.key === key ? { ...c, label: newLabel } : c))
    );
  };

  // ── Import (Step 3 → DB) ────────────────────────────────────────
  const handleImport = async () => {
    if (!detection || !selectedProjectId) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const activeColumns = columnOverrides.filter((c) => !c.ignored);

      // 1. Create the dataset record
      const { data: ds, error: dsErr } = await (supabase as any)
        .from("datasets")
        .insert({
          project_id: selectedProjectId,
          name: datasetName || "Untitled",
          category: selectedCategory,
          columns: activeColumns,
          row_count: detection.rows.length,
          file_size_bytes: 0,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (dsErr) throw new Error(dsErr.message);

      // 2. Batch-insert rows (chunks of 500)
      const CHUNK_SIZE = 500;
      const totalRows = detection.rows.length;
      for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = detection.rows.slice(i, i + CHUNK_SIZE).map((row, idx) => {
          // Only keep non-ignored columns
          const filtered: Record<string, any> = {};
          for (const col of activeColumns) {
            filtered[col.key] = row[col.key] ?? null;
          }
          return {
            dataset_id: ds.id,
            row_index: i + idx,
            row_data: filtered,
          };
        });

        const { error: rowErr } = await (supabase as any)
          .from("dataset_rows")
          .upsert(chunk, { onConflict: "dataset_id, row_index" });

        if (rowErr) throw new Error(rowErr.message);
        setUploadProgress(Math.min(100, Math.round(((i + CHUNK_SIZE) / totalRows) * 100)));
      }

      setSuccess(`Successfully imported ${totalRows} rows into "${datasetName}".`);
      setWizardStep(0);
      setDetection(null);
      fetchDatasets();
    } catch (err: any) {
      setError(err.message || "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Filtered datasets ───────────────────────────────────────────
  const filteredDatasets = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (d.projects?.title || "").toLowerCase().includes(searchFilter.toLowerCase())
  );

  // ═══════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════
  return (
    <Workspace>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Data Hub</h2>
            <p className="text-gray-500 text-[13px]">
              Upload, analyze, and manage datasets for your reports.
            </p>
          </div>
        </div>
        <Link
          href="/app/projects/report"
          className="text-[13px] text-blue-600 font-medium hover:underline flex items-center gap-1"
        >
          <BarChart3 size={14} />
          Report Builder
        </Link>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[13px] flex items-start gap-2 animate-in fade-in">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[13px] flex items-start gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Wizard is CLOSED: show upload zone + dataset list ──── */}
      {wizardStep === 0 && (
        <>
          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-8 cursor-pointer ${
              dragOver
                ? "border-blue-500 bg-blue-50 scale-[1.01]"
                : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-3">
                <Upload className="text-blue-600" size={24} />
              </div>
              <p className="text-[15px] font-semibold text-gray-800 mb-1">
                Drop your CSV here, or click to browse
              </p>
              <p className="text-[12px] text-gray-500">
                Any CSV structure accepted — columns will be auto-detected
              </p>
              <div className="flex gap-2 mt-3">
                {["📅 Dates", "🔢 Numbers", "💰 Currency", "📊 Percentages", "🏷️ Categories"].map((t) => (
                  <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Dataset list */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Layers size={16} />
              Your Datasets
              <span className="text-[12px] font-normal text-gray-500 ml-1">({datasets.length})</span>
            </h3>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-[13px] w-56 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {loadingDatasets ? (
            <div className="p-12 text-center text-gray-500 text-[13px]">
              <Loader2 className="animate-spin mx-auto mb-2" size={20} />
              Loading datasets...
            </div>
          ) : filteredDatasets.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
              <FileSpreadsheet className="mx-auto mb-3 text-gray-400" size={32} />
              <p className="text-[14px] text-gray-600 font-medium mb-1">No datasets yet</p>
              <p className="text-[12px] text-gray-500">Upload your first CSV to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDatasets.map((ds) => (
                <div key={ds.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden hover:shadow-sm transition-shadow">
                  {/* Card header */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-[14px] truncate">{ds.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500">{ds.projects?.title}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{ds.category}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] text-gray-500">{ds.row_count.toLocaleString()} rows</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] text-gray-500">{ds.columns?.length || 0} columns</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Column type pills */}
                      <div className="hidden md:flex gap-1">
                        {(ds.columns || []).filter((c: ColumnSchema) => !c.ignored).slice(0, 4).map((col: ColumnSchema) => (
                          <span
                            key={col.key}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_BADGES[col.type]?.color || "bg-gray-100 text-gray-600"}`}
                          >
                            {TYPE_BADGES[col.type]?.emoji} {col.label}
                          </span>
                        ))}
                        {(ds.columns || []).filter((c: ColumnSchema) => !c.ignored).length > 4 && (
                          <span className="text-[10px] text-gray-400">+{(ds.columns || []).filter((c: ColumnSchema) => !c.ignored).length - 4}</span>
                        )}
                      </div>

                      <button
                        onClick={() => loadDatasetRows(ds.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Preview data"
                      >
                        {expandedDatasetId === ds.id ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => deleteDataset(ds.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete dataset"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded row preview */}
                  {expandedDatasetId === ds.id && (
                    <div className="border-t border-gray-200 bg-gray-50 max-h-[400px] overflow-auto">
                      <table className="w-full text-left text-[12px]">
                        <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-gray-400 font-medium w-10">#</th>
                            {(ds.columns || []).filter((c: ColumnSchema) => !c.ignored).map((col: ColumnSchema) => (
                              <th key={col.key} className="px-3 py-2 font-medium text-gray-600">
                                <span className="mr-1">{TYPE_BADGES[col.type]?.emoji}</span>
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {expandedRows.length === 0 ? (
                            <tr><td colSpan={99} className="text-center py-6 text-gray-500">No rows to display.</td></tr>
                          ) : (
                            expandedRows.map((row, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-white">
                                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                                {(ds.columns || []).filter((c: ColumnSchema) => !c.ignored).map((col: ColumnSchema) => (
                                  <td key={col.key} className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">
                                    {row[col.key] ?? "—"}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── WIZARD STEP 2: Preview & Map Columns ──────────────── */}
      {wizardStep === 2 && detection && (
        <div className="space-y-6">
          {/* Wizard Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Column Detection</h3>
              <p className="text-[13px] text-gray-500">
                We detected {detection.columns.length} columns and {detection.totalRows.toLocaleString()} rows.
                {detection.duplicateCount > 0 && (
                  <span className="text-orange-600 ml-1">
                    ({detection.duplicateCount} potential duplicates)
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => { setWizardStep(0); setDetection(null); }}
              className="text-[13px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </div>

          {/* Config row */}
          <div className="grid grid-cols-3 gap-4 bg-white border border-gray-200 rounded-xl p-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Dataset Name</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Target Project</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-600 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Column cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {columnOverrides.map((col) => {
              const badge = TYPE_BADGES[col.type];
              return (
                <div
                  key={col.key}
                  className={`border rounded-xl p-4 transition-all ${
                    col.ignored
                      ? "border-gray-200 bg-gray-50 opacity-60"
                      : "border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => updateColumnLabel(col.key, e.target.value)}
                        className="font-semibold text-gray-900 text-[13px] bg-transparent border-none outline-none w-full p-0 focus:bg-blue-50 focus:px-1 rounded"
                      />
                      <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{col.key}</p>
                    </div>
                    <button
                      onClick={() => toggleColumnIgnore(col.key)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        col.ignored
                          ? "text-red-400 bg-red-50 hover:bg-red-100"
                          : "text-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                      }`}
                      title={col.ignored ? "Include column" : "Exclude column"}
                    >
                      {col.ignored ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {/* Type selector */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {badge.emoji} {badge.label}
                    </span>
                    <select
                      value={col.type}
                      onChange={(e) => updateColumnType(col.key, e.target.value as ColumnType)}
                      className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 outline-none"
                    >
                      <option value="date">📅 Date</option>
                      <option value="number">🔢 Number</option>
                      <option value="percentage">📊 Percent</option>
                      <option value="currency">💰 Currency</option>
                      <option value="category">🏷️ Category</option>
                      <option value="text">📝 Text</option>
                      <option value="empty">⬜ Empty</option>
                    </select>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <span>{Math.round(col.fillRate * 100)}% filled</span>
                    <span className="text-gray-300">•</span>
                    <span>{col.uniqueCount} unique</span>
                    {col.min !== undefined && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span>{col.min.toLocaleString()}–{col.max?.toLocaleString()}</span>
                      </>
                    )}
                  </div>

                  {/* Sample values */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {col.sampleValues.slice(0, 3).map((v, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Data Preview Table */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 text-[14px]">
                Data Preview
                <span className="text-[12px] font-normal text-gray-500 ml-2">
                  (showing first 20 of {detection.totalRows.toLocaleString()} rows)
                </span>
              </h4>
            </div>
            <div className="max-h-[350px] overflow-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                  <tr>
                    <th className="px-3 py-2 text-gray-400 font-medium w-10">#</th>
                    {columnOverrides.filter((c) => !c.ignored).map((col) => (
                      <th key={col.key} className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                        <span className="mr-1">{TYPE_BADGES[col.type]?.emoji}</span>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detection.rows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      {columnOverrides.filter((c) => !c.ignored).map((col) => (
                        <td key={col.key} className="px-3 py-1.5 text-gray-700 max-w-[180px] truncate">
                          {row[col.key] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Button */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-[13px] text-gray-600">
              <strong>{detection.totalRows.toLocaleString()}</strong> rows,{" "}
              <strong>{columnOverrides.filter((c) => !c.ignored).length}</strong> columns
              {detection.duplicateCount > 0 && (
                <span className="text-orange-600 ml-2">
                  ({detection.duplicateCount} duplicates)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setWizardStep(0); setDetection(null); }}
                className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={uploading || !selectedProjectId}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-[13px] font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Importing... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    Import Dataset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Workspace>
  );
}
