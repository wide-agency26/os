"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  Upload, Trash2, Loader2, Database, AlertCircle, CheckCircle2,
  FileSpreadsheet, Eye, EyeOff, X, BarChart3, Search, Layers, Pencil, Save,
  ChevronLeft, ChevronRight, Ban,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  ReportsHubShell,
  type ReportsProjectOption,
} from "@/components/reports/ReportsHubShell";
import {
  detectColumns,
  TYPE_BADGES,
  type ColumnSchema,
  type ColumnType,
  type DetectionResult,
} from "@/lib/data-hub/column-detector";
import { dataHubCategoriesForUpload } from "@/lib/reports/categories";
import { parseUploadFile, isAcceptedUploadName } from "@/lib/data-hub/parse-workbook";
import {
  detectSubcategory,
  subcategoryLabel,
  suggestedUploadCategory,
  type DatasetSubcategory,
} from "@/lib/data-hub/subcategory";
import { isFounder } from "@/lib/rbac";

const CATEGORIES = dataHubCategoriesForUpload();
const CATEGORY_HINTS: Record<string, string> = {
  Social: "Organic platform exports (Instagram, Facebook, LinkedIn, YouTube)",
  Ads: "Paid media exports (Meta Ads, Google Ads, LinkedIn Ads)",
  Website: "Google Analytics 4 (GA4) exports",
  SEO: "Google Search Console exports",
};

function suggestedCategory(sub: DatasetSubcategory): string {
  return suggestedUploadCategory(sub);
}

/** Sheets that are never useful as Data Hub datasets (config / cover / notes) */
function shouldAutoSkipSheet(name: string, sub: DatasetSubcategory): boolean {
  if (/report\s*config|configuration|readme|instructions|^notes$|cover\s*page|^index$/i.test(name)) {
    return true;
  }
  if (sub === "unknown" && /config|setup|meta\b|info\b|template/i.test(name)) return true;
  return false;
}

interface PendingSheet {
  id: string;
  sheetName: string;
  datasetName: string;
  selected: boolean;
  subcategory: DatasetSubcategory;
  category: string;
  detection: DetectionResult;
  columnOverrides: ColumnSchema[];
  reviewed: boolean;
}

const fieldClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-[13px] bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-gray-400";

interface ProjectOption {
  id: string;
  title: string;
  company?: string;
}

interface DatasetMeta {
  id: string;
  project_id: string;
  name: string;
  category: string;
  subcategory?: string | null;
  columns: ColumnSchema[];
  row_count: number;
  created_at: string;
  projects?: { title: string; crm_customers?: { company?: string; name?: string } | { company?: string; name?: string }[] | null };
}

function projectLabel(p: ProjectOption) {
  return p.company ? `${p.company} — ${p.title}` : p.title;
}

function datasetProjectLabel(ds: DatasetMeta) {
  const proj = ds.projects;
  if (!proj) return "No project";
  const custRaw = proj.crm_customers;
  const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;
  const company = cust?.company || cust?.name;
  return company ? `${company} — ${proj.title}` : proj.title;
}

function DataHubInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);
  const [expandedDatasetId, setExpandedDatasetId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, any>[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [hubProjectId, setHubProjectId] = useState(searchParams.get("project") || "");
  const [isAdmin, setIsAdmin] = useState(false);

  // Wizard: 0 closed, 1 setup (project required), 2 columns
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Website");
  const [datasetName, setDatasetName] = useState("");
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<ColumnSchema[]>([]);
  const [pendingSheets, setPendingSheets] = useState<PendingSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [detectedSubcategory, setDetectedSubcategory] =
    useState<DatasetSubcategory>("unknown");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Edit existing dataset
  const [editingDataset, setEditingDataset] = useState<DatasetMeta | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editCategory, setEditCategory] = useState("Website");
  const [editColumns, setEditColumns] = useState<ColumnSchema[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchProjects();
    void fetchDatasets();
  }, []);

  async function fetchProjects() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setIsAdmin(isFounder(profile?.role));
    }

    const { data } = await (supabase as any)
      .from("projects")
      .select(
        `
        id,
        title,
        crm_customers!client_id (
          company,
          name
        )
      `
      )
      .order("title");

    if (data) {
      const mapped: ProjectOption[] = data.map((p: any) => {
        const cust = Array.isArray(p.crm_customers) ? p.crm_customers[0] : p.crm_customers;
        return {
          id: p.id,
          title: p.title,
          company: cust?.company || cust?.name || undefined,
        };
      });
      setProjects(mapped);
      const fromUrl = searchParams.get("project");
      const next =
        fromUrl && mapped.some((p) => p.id === fromUrl) ? fromUrl : mapped[0]?.id || "";
      setHubProjectId(next);
      if (next) {
        setProjectFilter(next);
        setSelectedProjectId((prev) => prev || next);
      }
    }
  }

  const onHubProjectChange = useCallback((id: string) => {
    setHubProjectId(id);
    if (id) {
      setProjectFilter(id);
      setSelectedProjectId(id);
    }
  }, []);

  async function fetchDatasets() {
    setLoadingDatasets(true);
    const { data, error: fetchErr } = await (supabase as any)
      .from("datasets")
      .select(
        `
        id,
        project_id,
        name,
        category,
        subcategory,
        columns,
        row_count,
        created_at,
        projects (
          title,
          crm_customers!client_id (
            company,
            name
          )
        )
      `
      )
      .order("created_at", { ascending: false });
    if (!fetchErr && data) setDatasets(data);
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
    if (editingDataset?.id === id) setEditingDataset(null);
    void fetchDatasets();
  }

  function openEdit(ds: DatasetMeta) {
    setEditingDataset(ds);
    setEditName(ds.name);
    setEditProjectId(ds.project_id);
    setEditCategory(ds.category || "Website");
    setEditColumns([...(ds.columns || [])]);
    setError(null);
  }

  async function saveDatasetEdit() {
    if (!editingDataset) return;
    if (!editProjectId) {
      setError("Please select a project for this dataset.");
      return;
    }
    if (!editName.trim()) {
      setError("Dataset name is required.");
      return;
    }

    setSavingEdit(true);
    setError(null);
    try {
      const { error: updErr } = await (supabase as any)
        .from("datasets")
        .update({
          name: editName.trim(),
          project_id: editProjectId,
          category: editCategory,
          columns: editColumns,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingDataset.id);

      if (updErr) throw new Error(updErr.message);

      setSuccess(`Updated “${editName.trim()}”.`);
      setEditingDataset(null);
      await fetchDatasets();
    } catch (err: any) {
      setError(err.message || "Failed to update dataset.");
    } finally {
      setSavingEdit(false);
    }
  }

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setSuccess(null);
    setSelectedProjectId("");
    setPendingSheets([]);
    setActiveSheetId(null);

    if (!isAcceptedUploadName(file.name)) {
      setError("Please upload a CSV, TSV, XLS, or XLSX file.");
      return;
    }

    try {
      const sheets = await parseUploadFile(file);
      const baseName = file.name.replace(/\.(csv|tsv|txt|xlsx|xls)$/i, "");

      const pending: PendingSheet[] = sheets.map((sheet, idx) => {
        const detectionResult = detectColumns(sheet.rows);
        // Prefer sheet tab name for prefix detection (Li -, YT -, Web -)
        const sub = detectSubcategory(sheet.name, detectionResult.columns);
        const name = sheets.length === 1 ? baseName || sheet.name : sheet.name;
        return {
          id: `sheet-${idx}`,
          sheetName: sheet.name,
          datasetName: name,
          selected: !shouldAutoSkipSheet(sheet.name, sub),
          subcategory: sub,
          category: suggestedCategory(sub),
          detection: detectionResult,
          columnOverrides: [...detectionResult.columns],
          reviewed: false,
        };
      });

      setPendingSheets(pending);
      const firstActive = pending.find((s) => s.selected) || pending[0];
      setActiveSheetId(firstActive.id);
      setDetection(firstActive.detection);
      setColumnOverrides([...firstActive.columnOverrides]);
      setDatasetName(firstActive.datasetName);
      setDetectedSubcategory(firstActive.subcategory);
      setSelectedCategory(firstActive.category);
      setWizardStep(1);
    } catch (err: any) {
      setError(err?.message || "Failed to parse file.");
      setWizardStep(0);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && isAcceptedUploadName(file.name)) {
        void processFile(file);
      } else {
        setError("Please drop a CSV, TSV, XLS, or XLSX file.");
      }
    },
    [processFile]
  );

  const persistActiveSheetState = (): PendingSheet[] => {
    return pendingSheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            columnOverrides: [...columnOverrides],
            datasetName,
            subcategory: detectedSubcategory,
            category: selectedCategory,
            reviewed: true,
          }
        : s
    );
  };

  const selectSheetForEdit = (sheetId: string) => {
    const synced = persistActiveSheetState();
    const target = synced.find((s) => s.id === sheetId);
    if (!target) return;
    setPendingSheets(synced);
    setActiveSheetId(sheetId);
    setDetection(target.detection);
    setColumnOverrides([...target.columnOverrides]);
    setDatasetName(target.datasetName);
    setDetectedSubcategory(target.subcategory);
    setSelectedCategory(target.category);
  };

  const goToAdjacentSheet = (dir: -1 | 1) => {
    const synced = persistActiveSheetState();
    setPendingSheets(synced);
    // Walk every sheet (including skipped) so you can skip/re-include as you go
    const ids = synced.map((s) => s.id);
    const idx = ids.indexOf(activeSheetId || "");
    const nextId = ids[idx + dir];
    if (!nextId) return;
    const target = synced.find((s) => s.id === nextId);
    if (!target) return;
    setActiveSheetId(nextId);
    setDetection(target.detection);
    setColumnOverrides([...target.columnOverrides]);
    setDatasetName(target.datasetName);
    setDetectedSubcategory(target.subcategory);
    setSelectedCategory(target.category);
  };

  const setSheetSelected = (sheetId: string, selected: boolean) => {
    setPendingSheets((prev) =>
      prev.map((s) =>
        s.id === sheetId
          ? { ...s, selected, reviewed: selected ? s.reviewed : true }
          : s
      )
    );
  };

  const skipActiveSheetAndAdvance = () => {
    const synced = persistActiveSheetState().map((s) =>
      s.id === activeSheetId ? { ...s, selected: false, reviewed: true } : s
    );
    setPendingSheets(synced);
    const ids = synced.map((s) => s.id);
    const idx = ids.indexOf(activeSheetId || "");
    const nextId = ids[idx + 1] || ids[idx - 1];
    if (!nextId || nextId === activeSheetId) return;
    const target = synced.find((s) => s.id === nextId);
    if (!target) return;
    setActiveSheetId(nextId);
    setDetection(target.detection);
    setColumnOverrides([...target.columnOverrides]);
    setDatasetName(target.datasetName);
    setDetectedSubcategory(target.subcategory);
    setSelectedCategory(target.category);
  };

  const toggleColumnIgnore = (key: string, target: "wizard" | "edit") => {
    const setter = target === "wizard" ? setColumnOverrides : setEditColumns;
    setter((prev) => prev.map((c) => (c.key === key ? { ...c, ignored: !c.ignored } : c)));
  };

  const updateColumnType = (key: string, newType: ColumnType, target: "wizard" | "edit") => {
    const setter = target === "wizard" ? setColumnOverrides : setEditColumns;
    setter((prev) => prev.map((c) => (c.key === key ? { ...c, type: newType } : c)));
  };

  const updateColumnLabel = (key: string, newLabel: string, target: "wizard" | "edit") => {
    const setter = target === "wizard" ? setColumnOverrides : setEditColumns;
    setter((prev) => prev.map((c) => (c.key === key ? { ...c, label: newLabel } : c)));
  };

  const closeWizard = () => {
    setWizardStep(0);
    setDetection(null);
    setSelectedProjectId("");
    setPendingSheets([]);
    setActiveSheetId(null);
    setDetectedSubcategory("unknown");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const syncActiveSheet = (): PendingSheet[] => {
    return pendingSheets.map((s) =>
      s.id === activeSheetId
        ? {
            ...s,
            columnOverrides: [...columnOverrides],
            datasetName,
            subcategory: detectedSubcategory,
            category: selectedCategory,
          }
        : s
    );
  };

  const handleImport = async () => {
    if (!detection && pendingSheets.length === 0) return;
    if (!selectedProjectId) {
      setError("Select which project this dataset belongs to before importing.");
      setWizardStep(1);
      return;
    }

    const sheets = syncActiveSheet().filter((s) => s.selected);
    if (!sheets.length) {
      setError("Select at least one sheet to import.");
      return;
    }
    for (const s of sheets) {
      if (!s.datasetName.trim()) {
        setError(`Give sheet “${s.sheetName}” a dataset name before importing.`);
        setWizardStep(1);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imported = 0;
      const totalSheets = sheets.length;

      for (let si = 0; si < sheets.length; si++) {
        const sheet = sheets[si];
        const activeColumns = sheet.columnOverrides.filter((c) => !c.ignored);
        const sheetCategory = sheet.category || selectedCategory;

        const { data: ds, error: dsErr } = await (supabase as any)
          .from("datasets")
          .insert({
            project_id: selectedProjectId,
            name: sheet.datasetName.trim(),
            category: sheetCategory,
            subcategory:
              sheet.subcategory === "unknown" ? null : sheet.subcategory,
            columns: activeColumns,
            row_count: sheet.detection.rows.length,
            file_size_bytes: 0,
            created_by: user.id,
            is_current: true,
            supersedes_id: null,
          })
          .select("id")
          .single();

        if (dsErr) throw new Error(dsErr.message);

        // Mark prior upload(s) for same project + subcategory as not current;
        // keep their rows so static snapshots can still be compared.
        const sub =
          sheet.subcategory === "unknown" ? null : sheet.subcategory;
        if (sub) {
          const { data: priors } = await (supabase as any)
            .from("datasets")
            .select("id")
            .eq("project_id", selectedProjectId)
            .eq("subcategory", sub)
            .eq("is_current", true)
            .neq("id", ds.id);
          const priorIds = (priors || []).map((p: { id: string }) => p.id);
          if (priorIds.length) {
            await (supabase as any)
              .from("datasets")
              .update({ is_current: false })
              .in("id", priorIds);
            await (supabase as any)
              .from("datasets")
              .update({ supersedes_id: priorIds[0] })
              .eq("id", ds.id);
          }
        } else {
          // Fallback: same project + exact dataset name
          const { data: priors } = await (supabase as any)
            .from("datasets")
            .select("id")
            .eq("project_id", selectedProjectId)
            .eq("name", sheet.datasetName.trim())
            .eq("is_current", true)
            .neq("id", ds.id);
          const priorIds = (priors || []).map((p: { id: string }) => p.id);
          if (priorIds.length) {
            await (supabase as any)
              .from("datasets")
              .update({ is_current: false })
              .in("id", priorIds);
            await (supabase as any)
              .from("datasets")
              .update({ supersedes_id: priorIds[0] })
              .eq("id", ds.id);
          }
        }

        const CHUNK_SIZE = 500;
        const totalRows = sheet.detection.rows.length;
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          const chunk = sheet.detection.rows.slice(i, i + CHUNK_SIZE).map((row, idx) => {
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
        }

        imported += 1;
        setUploadProgress(Math.round(((si + 1) / totalSheets) * 100));
      }

      const proj = projects.find((p) => p.id === selectedProjectId);
      setSuccess(
        `Imported ${imported} dataset${imported === 1 ? "" : "s"} for ${
          proj ? projectLabel(proj) : "selected project"
        }.`
      );
      closeWizard();
      void fetchDatasets();
    } catch (err: any) {
      setError(err.message || "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredDatasets = datasets.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      d.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      datasetProjectLabel(d).toLowerCase().includes(searchFilter.toLowerCase());
    const matchesProject = projectFilter === "all" || d.project_id === projectFilter;
    return matchesSearch && matchesProject;
  });

  const renderColumnEditor = (
    cols: ColumnSchema[],
    target: "wizard" | "edit",
    compact = false
  ) => (
    <div className={`grid grid-cols-1 ${compact ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"} gap-3`}>
      {cols.map((col) => {
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
            <div className="flex items-start justify-between mb-2 gap-2">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={col.label}
                  onChange={(e) => updateColumnLabel(col.key, e.target.value, target)}
                  className="font-semibold text-gray-900 text-[13px] bg-white border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1 w-full outline-none"
                />
                <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">{col.key}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleColumnIgnore(col.key, target)}
                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                  col.ignored
                    ? "text-red-400 bg-red-50 hover:bg-red-100"
                    : "text-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                }`}
                title={col.ignored ? "Include column" : "Exclude column"}
              >
                {col.ignored ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                {badge.emoji} {badge.label}
              </span>
              <select
                value={col.type}
                onChange={(e) => updateColumnType(col.key, e.target.value as ColumnType, target)}
                className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white text-gray-900 outline-none"
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

            {!compact && (
              <>
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span>{Math.round(col.fillRate * 100)}% filled</span>
                  <span className="text-gray-300">•</span>
                  <span>{col.uniqueCount} unique</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {col.sampleValues.slice(0, 3).map((v, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded truncate max-w-[100px]"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <Workspace wide>
      <ReportsHubShell
        projects={projects as ReportsProjectOption[]}
        selectedProjectId={hubProjectId}
        onProjectChange={onHubProjectChange}
        isAdmin={isAdmin}
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
          <Database size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Hub</h2>
          <p className="text-gray-500 text-[13px]">
            Upload platform CSVs tagged to the selected project — feeds Report Viewer, Funnel, and Insights.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[13px] flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[13px] flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="ml-auto">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Closed: upload + list ── */}
      {wizardStep === 0 && (
        <>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-8 cursor-pointer ${
              dragOver
                ? "border-blue-500 bg-blue-50 scale-[1.01]"
                : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-3">
                <Upload className="text-blue-600" size={24} />
              </div>
              <p className="text-[15px] font-semibold text-gray-800 mb-1">
                Drop CSV or Excel here, or click to browse
              </p>
              <p className="text-[12px] text-gray-500 max-w-md mx-auto">
                Name sheets with prefixes: <span className="font-medium">Li -</span>,{" "}
                <span className="font-medium">YT -</span>,{" "}
                <span className="font-medium">Web -</span> — then review each tab before import
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Layers size={16} />
              Your Datasets
              <span className="text-[12px] font-normal text-gray-500 ml-1">
                ({filteredDatasets.length})
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="border border-gray-200 rounded-lg text-[13px] px-2.5 py-1.5 bg-white text-gray-900 outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {projectLabel(p)}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search datasets..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-[13px] w-56 bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
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
                <div
                  key={ds.id}
                  className="border border-gray-200 rounded-xl bg-white overflow-hidden hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-[14px] truncate">{ds.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-gray-500">{datasetProjectLabel(ds)}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {ds.category}
                          {ds.subcategory ? ` · ${subcategoryLabel(ds.subcategory)}` : ""}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] text-gray-500">
                          {ds.row_count.toLocaleString()} rows
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-[11px] text-gray-500">
                          {ds.columns?.length || 0} columns
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="hidden lg:flex gap-1 mr-1">
                        {(ds.columns || [])
                          .filter((c) => !c.ignored)
                          .slice(0, 4)
                          .map((col) => (
                            <span
                              key={col.key}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                TYPE_BADGES[col.type]?.color || "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {TYPE_BADGES[col.type]?.emoji} {col.label}
                            </span>
                          ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(ds)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit dataset details"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => loadDatasetRows(ds.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Preview data"
                      >
                        {expandedDatasetId === ds.id ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDataset(ds.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete dataset"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {expandedDatasetId === ds.id && (
                    <div className="border-t border-gray-200 bg-gray-50 max-h-[400px] overflow-auto">
                      <table className="w-full text-left text-[12px]">
                        <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-gray-400 font-medium w-10">#</th>
                            {(ds.columns || [])
                              .filter((c) => !c.ignored)
                              .map((col) => (
                                <th key={col.key} className="px-3 py-2 font-medium text-gray-600">
                                  <span className="mr-1">{TYPE_BADGES[col.type]?.emoji}</span>
                                  {col.label}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {expandedRows.length === 0 ? (
                            <tr>
                              <td colSpan={99} className="text-center py-6 text-gray-500">
                                No rows to display.
                              </td>
                            </tr>
                          ) : (
                            expandedRows.map((row, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-white">
                                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                                {(ds.columns || [])
                                  .filter((c) => !c.ignored)
                                  .map((col) => (
                                    <td
                                      key={col.key}
                                      className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate"
                                    >
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


      {/* ── Step 1: Project ── */}
      {wizardStep === 1 && detection && (
        <div className="space-y-6 max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-1">
                Step 1 of 2
              </p>
              <h3 className="text-lg font-bold text-gray-900">Choose the project</h3>
              <p className="text-[13px] text-gray-500 mt-1">
                {pendingSheets.length > 1
                  ? `${pendingSheets.length} sheets detected (Li -, YT -, Web -, …). Next you’ll review each sheet one by one.`
                  : `Detected ${detection.totalRows.toLocaleString()} rows and ${detection.columns.length} columns.`}
              </p>
            </div>
            <button
              type="button"
              onClick={closeWizard}
              className="text-[13px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                Project <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={fieldClass}
                autoFocus
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {projectLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            {pendingSheets.length > 1 && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] font-semibold text-gray-600">
                    Sheets found — uncheck any you don’t want to import
                  </p>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        setPendingSheets((prev) => prev.map((s) => ({ ...s, selected: true })))
                      }
                    >
                      Select all
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      className="text-blue-600 hover:underline"
                      onClick={() =>
                        setPendingSheets((prev) => prev.map((s) => ({ ...s, selected: false })))
                      }
                    >
                      Select none
                    </button>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {pendingSheets.map((s) => (
                    <li
                      key={s.id}
                      className={`text-[12px] flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                        s.selected ? "bg-white border border-gray-200" : "bg-gray-100/80 text-gray-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={() => setSheetSelected(s.id, !s.selected)}
                        className="rounded border-gray-300"
                      />
                      <span className={`truncate font-medium flex-1 ${!s.selected ? "line-through" : ""}`}>
                        {s.sheetName}
                      </span>
                      <span className="text-gray-500 shrink-0 text-[11px]">
                        {subcategoryLabel(s.subcategory)} · {s.category}
                      </span>
                      {!s.selected && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          Skip
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-gray-500 mt-2">
                  {pendingSheets.filter((s) => s.selected).length} of {pendingSheets.length} will be
                  imported. You can still change this while reviewing.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeWizard}
              className="px-4 py-2 text-[13px] text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedProjectId}
              onClick={() => {
                if (!selectedProjectId) {
                  setError("Select a project before continuing.");
                  return;
                }
                setPendingSheets(syncActiveSheet());
                setError(null);
                setWizardStep(2);
              }}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Review sheets →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review each sheet ── */}
      {wizardStep === 2 && detection && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-1">
                Step 2 of 2 · Sheet review
              </p>
              <h3 className="text-lg font-bold text-gray-900">
                {pendingSheets.length > 1
                  ? `Review sheet ${Math.max(1, pendingSheets.findIndex((s) => s.id === activeSheetId) + 1)} of ${pendingSheets.length}`
                  : "Map columns"}
              </h3>
              <p className="text-[13px] text-gray-500">
                Project:{" "}
                <span className="font-medium text-gray-800">
                  {projects.find((p) => p.id === selectedProjectId)
                    ? projectLabel(projects.find((p) => p.id === selectedProjectId)!)
                    : "—"}
                </span>
                . Skip sheets you don’t need — only selected sheets are imported.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingSheets(syncActiveSheet());
                  setWizardStep(1);
                }}
                className="text-[13px] text-gray-600 hover:text-gray-800 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={closeWizard}
                className="text-[13px] text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>

          {pendingSheets.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
              <div className="flex flex-wrap gap-1.5">
                {pendingSheets.map((s, i) => {
                  const active = activeSheetId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`inline-flex items-center max-w-[220px] rounded-lg border text-[11px] font-medium overflow-hidden ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : s.selected
                            ? s.reviewed
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-gray-200 bg-white text-gray-700"
                            : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectSheetForEdit(s.id)}
                        className="px-2.5 py-1.5 truncate hover:opacity-90"
                        title={`${s.sheetName} · ${subcategoryLabel(s.subcategory)}${
                          s.selected ? "" : " · skipped"
                        }`}
                      >
                        {i + 1}. {s.sheetName}
                        {!s.selected ? " · skip" : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSheetSelected(s.id, !s.selected)}
                        className={`px-1.5 py-1.5 border-l shrink-0 ${
                          active
                            ? "border-blue-500 hover:bg-blue-500"
                            : s.selected
                              ? "border-gray-200 hover:bg-red-50 text-gray-500 hover:text-red-600"
                              : "border-amber-200 hover:bg-amber-100 text-amber-700"
                        }`}
                        title={s.selected ? "Skip this sheet" : "Include this sheet"}
                      >
                        {s.selected ? <X size={12} /> : <CheckCircle2 size={12} />}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                Green = reviewed · Amber = skipped · Click × on a tab to skip, or ✓ to re-include.
              </p>
            </div>
          )}

          {(() => {
            const isSkipped = !(
              pendingSheets.find((s) => s.id === activeSheetId)?.selected ?? true
            );
            return (
          <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[12px]">
                <button
                  type="button"
                  onClick={() => activeSheetId && setSheetSelected(activeSheetId, true)}
                  className={`px-3 py-1.5 font-medium inline-flex items-center gap-1.5 ${
                    !isSkipped
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <CheckCircle2 size={13} /> Import sheet
                </button>
                <button
                  type="button"
                  onClick={() => skipActiveSheetAndAdvance()}
                  className={`px-3 py-1.5 font-medium inline-flex items-center gap-1.5 ${
                    isSkipped
                      ? "bg-amber-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Ban size={13} /> Skip sheet
                </button>
              </div>
              {pendingSheets.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToAdjacentSheet(-1)}
                    disabled={pendingSheets.findIndex((s) => s.id === activeSheetId) <= 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronLeft size={14} /> Prev sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => goToAdjacentSheet(1)}
                    disabled={
                      pendingSheets.findIndex((s) => s.id === activeSheetId) >=
                      pendingSheets.length - 1
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next sheet <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {isSkipped && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                <strong>This sheet will not be imported.</strong> Column mapping is ignored.
                Switch back to “Import sheet” if you change your mind.
              </div>
            )}

            {!isSkipped && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  Dataset name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. YT - Table data"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  Stream tag
                </label>
                <select
                  value={detectedSubcategory}
                  onChange={(e) => {
                    const sub = e.target.value as DatasetSubcategory;
                    setDetectedSubcategory(sub);
                    setSelectedCategory(suggestedCategory(sub));
                  }}
                  className={fieldClass}
                >
                  {(
                    [
                      "unknown",
                      "linkedin_metrics",
                      "linkedin_visitors",
                      "linkedin_followers",
                      "linkedin_posts",
                      "linkedin_demo_seniority",
                      "linkedin_demo_industry",
                      "linkedin_demo_job_function",
                      "linkedin_demo_company_size",
                      "youtube_table",
                      "youtube_chart",
                      "youtube_organic",
                      "meta_ads",
                      "google_ads",
                      "linkedin_ads",
                      "ga4",
                      "gsc",
                      "gsc_queries",
                      "gsc_pages",
                      "gsc_dates",
                      "gsc_countries",
                      "gsc_devices",
                      "gsc_search_appearance",
                      "instagram_organic",
                      "facebook_organic",
                    ] as DatasetSubcategory[]
                  ).map((sub) => (
                    <option key={sub} value={sub}>
                      {subcategoryLabel(sub)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={fieldClass}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  {CATEGORY_HINTS[selectedCategory] || ""}
                </p>
              </div>
            </div>
            )}
          </div>

          {!isSkipped && renderColumnEditor(columnOverrides, "wizard")}

          {!isSkipped && (
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h4 className="font-semibold text-gray-900 text-[14px]">
                Preview
                <span className="text-[12px] font-normal text-gray-500 ml-2">
                  (first 20 of {detection.totalRows.toLocaleString()} rows)
                </span>
              </h4>
            </div>
            <div className="max-h-[350px] overflow-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-white sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-gray-400 font-medium w-10">#</th>
                    {columnOverrides
                      .filter((c) => !c.ignored)
                      .map((col) => (
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
                      {columnOverrides
                        .filter((c) => !c.ignored)
                        .map((col) => (
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
          )}
          </>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-4 sticky bottom-2 shadow-md">
            <div className="text-[13px] text-gray-600">
              <strong>{pendingSheets.filter((s) => s.selected).length}</strong> sheet
              {pendingSheets.filter((s) => s.selected).length === 1 ? "" : "s"} selected
              {pendingSheets.some((s) => !s.selected) && (
                <>
                  {" "}
                  · <strong>{pendingSheets.filter((s) => !s.selected).length}</strong> skipped
                </>
              )}
              {pendingSheets.find((s) => s.id === activeSheetId)?.selected && (
                <>
                  {" "}
                  · <strong>{detection.totalRows.toLocaleString()}</strong> rows on this sheet
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pendingSheets.length > 1 &&
                pendingSheets.findIndex((s) => s.id === activeSheetId) <
                  pendingSheets.length - 1 && (
                  <button
                    type="button"
                    onClick={() => goToAdjacentSheet(1)}
                    className="px-4 py-2 text-[13px] border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1"
                  >
                    Save & next <ChevronRight size={14} />
                  </button>
                )}
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={
                  uploading ||
                  !selectedProjectId ||
                  pendingSheets.filter((s) => s.selected).length === 0 ||
                  (!!(pendingSheets.find((s) => s.id === activeSheetId)?.selected) &&
                    !datasetName.trim())
                }
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
                    {pendingSheets.filter((s) => s.selected).length > 1
                      ? `Import ${pendingSheets.filter((s) => s.selected).length} sheets`
                      : pendingSheets.filter((s) => s.selected).length === 1
                        ? "Import dataset"
                        : "No sheets selected"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit existing dataset modal ── */}
      {editingDataset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit dataset</h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Change project, name, category, or column mapping without re-uploading.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDataset(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                    Dataset name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                    Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editProjectId}
                    onChange={(e) => setEditProjectId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {projectLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className={fieldClass}
                  >
                    {[...new Set([...CATEGORIES, editCategory].filter(Boolean))].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <h4 className="text-[13px] font-semibold text-gray-800 mb-3">Columns</h4>
                {renderColumnEditor(editColumns, "edit", true)}
              </div>

              <p className="text-[11px] text-gray-500">
                {editingDataset.row_count.toLocaleString()} rows stay as uploaded. Moving the
                dataset to another project only changes which project Report Builder shows it under.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0 bg-gray-50">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingDataset(null)}
                className="px-4 py-2 text-[13px] text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit || !editProjectId || !editName.trim()}
                onClick={() => void saveDatasetEdit()}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {savingEdit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save changes
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

export default function DataHubPage() {
  return (
    <Suspense
      fallback={
        <Workspace wide>
          <div className="flex justify-center py-20 text-gray-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        </Workspace>
      }
    >
      <DataHubInner />
    </Suspense>
  );
}
