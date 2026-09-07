"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { generateUUID, type CIAsset, type CISection, type CITheme } from "@/lib/ci-builder/types";
import { CI_SCHEMA_VERSION } from "@/lib/ci-builder/types";
import { defaultDataForSubModule, getSubModule, sortSectionsByCatalog } from "@/lib/ci-builder/modules-catalog";
import {
  needsLegacyMigration,
  needsLogoMarksMigration,
} from "@/lib/ci-builder/migrate-legacy-sections";
import {
  needsColorFamilyPromotion,
  promoteColorFamilyCards,
} from "@/lib/ci-builder/color-families";
import { polishClientFacingSections } from "@/lib/ci-builder/polish-client-content";
import { deleteCiSection, migrateCiGuidelineToSubmodules } from "@/app/actions/ci-builder";
import { triggerToast } from "@/components/ci-builder/Toast";
import { useTouchRecentProject } from "@/components/tools/useTouchRecentProject";
import { ensureReadableTheme } from "@/lib/ci-builder/theme-css";

export type SaveStatus = "saved" | "saving" | "error";

const ROLE_COLOR_TYPES = new Set(["color_primary", "color_secondary", "color_accent"]);

export function useCiGuideline(projectId: string) {
  useTouchRecentProject("ci", projectId);
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guideline, setGuideline] = useState<any>(null);
  const [sections, setSections] = useState<Partial<CISection>[]>([]);
  const [assets, setAssets] = useState<Partial<CIAsset>[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("Brand");
  const [migrating, setMigrating] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<
    Map<string, { data?: unknown; fields?: Record<string, unknown> }>
  >(new Map());
  const sectionsRef = useRef<Partial<CISection>[]>([]);

  const orderedSections = useMemo(() => sortSectionsByCatalog(sections), [sections]);
  sectionsRef.current = orderedSections;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: proj } = await (supabase as any)
        .from("projects")
        .select("title")
        .eq("id", projectId)
        .maybeSingle();
      if (proj?.title) setBrandName(proj.title);

      let { data: gl, error: glErr } = await (supabase as any)
        .from("ci_guidelines")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (glErr) throw glErr;

      if (!gl) {
        const { data: newGl, error: createErr } = await (supabase as any)
          .from("ci_guidelines")
          .insert({
            project_id: projectId,
            theme: { schemaVersion: CI_SCHEMA_VERSION, clientTemplate: "greenpoint" },
          })
          .select()
          .single();
        if (createErr) throw createErr;
        gl = newGl;
      }
      setGuideline(gl);
      const themeCover = String((gl.theme as CITheme | undefined)?.coverTitle || "").trim();
      if (themeCover) setBrandName(themeCover);
      else if (proj?.title) setBrandName(proj.title);

      let { data: secs, error: secErr } = await (supabase as any)
        .from("ci_sections")
        .select("*")
        .eq("guideline_id", gl.id)
        .order("position", { ascending: true });
      if (secErr) throw secErr;

      let { data: asts, error: astErr } = await (supabase as any)
        .from("ci_assets")
        .select("*")
        .eq("guideline_id", gl.id);
      if (astErr) throw astErr;

      if (secs && (needsLegacyMigration(secs) || needsLogoMarksMigration(secs))) {
        setMigrating(true);
        const mig = await migrateCiGuidelineToSubmodules(projectId);
        setMigrating(false);
        if (!mig.ok) throw new Error(mig.error || "Failed to migrate legacy sections");
        if (mig.migrated) {
          secs = mig.sections || [];
          asts = mig.assets || [];
          triggerToast("Adapted imported sections to the CI Canvas modules");
        }
      }

      if (secs) {
        let workingSecs = secs as Partial<CISection>[];
        const themeAccent = Array.isArray((gl.theme as CITheme | undefined)?.accentColors)
          ? (gl.theme as CITheme).accentColors?.[0]
          : null;
        if (needsColorFamilyPromotion(workingSecs)) {
          const promoted = promoteColorFamilyCards(workingSecs, { themeAccent });
          if (promoted.changed) {
            workingSecs = promoted.sections;
            await Promise.all(
              workingSecs
                .filter((s) => s.id && ROLE_COLOR_TYPES.has(String(s.section_type || "")))
                .map((s) =>
                  (supabase as any)
                    .from("ci_sections")
                    .update({ data: s.data || {} })
                    .eq("id", s.id)
                )
            );
          }
        }
        const polished = polishClientFacingSections(workingSecs, {
          guidelineId: gl.id,
          theme: gl.theme,
        });
        if (polished.changed) {
          const before = new Map(
            workingSecs.map((s) => [
              s.id,
              JSON.stringify({ d: s.description, data: s.data }),
            ])
          );
          workingSecs = polished.sections;
          await Promise.all(
            polished.sections
              .filter((s) => {
                if (!s.id) return false;
                return (
                  before.get(s.id) !==
                  JSON.stringify({ d: s.description, data: s.data })
                );
              })
              .map((s) =>
                (supabase as any)
                  .from("ci_sections")
                  .update({ description: s.description ?? null, data: s.data || {} })
                  .eq("id", s.id)
              )
          );
        }
        setSections(sortSectionsByCatalog(workingSecs));
      }
      if (asts) setAssets(asts);
      setSaveStatus("saved");
    } catch (err: any) {
      setLoadError(`Failed to load guideline: ${err.message || err}`);
      setSaveStatus("error");
      setMigrating(false);
    } finally {
      setLoading(false);
    }
  }, [projectId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const flushPendingSaves = useCallback(async (): Promise<boolean> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingUpdatesRef.current.size === 0) {
      setSaveStatus("saved");
      setSaveErrorMsg(null);
      return true;
    }
    setSaveStatus("saving");
    const updatesToProcess = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();
    try {
      for (const [sectionId, update] of updatesToProcess.entries()) {
        if (!sectionId) continue;
        if (update.data !== undefined) {
          const { error } = await (supabase as any)
            .from("ci_sections")
            .update({ data: update.data })
            .eq("id", sectionId);
          if (error) throw error;
        }
        if (update.fields && Object.keys(update.fields).length > 0) {
          const { error } = await (supabase as any)
            .from("ci_sections")
            .update(update.fields)
            .eq("id", sectionId);
          if (error) throw error;
        }
      }
      setSaveStatus("saved");
      setSaveErrorMsg(null);
      return true;
    } catch (err: any) {
      updatesToProcess.forEach((val, key) => pendingUpdatesRef.current.set(key, val));
      setSaveStatus("error");
      setSaveErrorMsg(err.message || "Failed to save");
      return false;
    }
  }, [supabase]);

  const scheduleDebouncedSave = (sectionId: string, type: "data" | "fields", payload: any) => {
    setSaveStatus("saving");
    const prev = pendingUpdatesRef.current.get(sectionId) || {};
    if (type === "data") {
      pendingUpdatesRef.current.set(sectionId, { ...prev, data: payload });
    } else {
      pendingUpdatesRef.current.set(sectionId, {
        ...prev,
        fields: { ...prev.fields, ...payload },
      });
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void flushPendingSaves();
    }, 600);
  };

  const patchSectionData = useCallback((sectionId: string, newData: any) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, data: newData } : s)));
    scheduleDebouncedSave(sectionId, "data", newData);
  }, []);

  const ensureSection = useCallback(
    async (sectionType: string): Promise<Partial<CISection> | null> => {
      const existing = sectionsRef.current.find((s) => s.section_type === sectionType);
      if (existing?.id) return existing;
      if (!guideline?.id) return null;
      const catalog = getSubModule(sectionType);
      const created: Partial<CISection> = {
        id: generateUUID(),
        guideline_id: guideline.id,
        section_type: sectionType as CISection["section_type"],
        eyebrow_label: catalog?.eyebrow || sectionType,
        headline: catalog?.defaultHeadline || sectionType,
        position: sectionsRef.current.length,
        is_visible: true,
        data: defaultDataForSubModule(sectionType),
      };
      setSections((prev) => sortSectionsByCatalog([...prev, created]));
      setSaveStatus("saving");
      const { error } = await (supabase as any).from("ci_sections").insert(created);
      if (error) {
        setSaveStatus("error");
        setSaveErrorMsg(error.message);
        return null;
      }
      setSaveStatus("saved");
      return created;
    },
    [guideline?.id, supabase]
  );

  const insertSection = useCallback(
    async (sectionType: string, data?: Record<string, unknown>): Promise<Partial<CISection> | null> => {
      if (!guideline?.id) return null;
      const catalog = getSubModule(sectionType);
      const created: Partial<CISection> = {
        id: generateUUID(),
        guideline_id: guideline.id,
        section_type: sectionType as CISection["section_type"],
        eyebrow_label: catalog?.eyebrow || sectionType,
        headline: catalog?.defaultHeadline || sectionType,
        position: sectionsRef.current.length,
        is_visible: true,
        data: data || defaultDataForSubModule(sectionType),
      };
      setSections((prev) => sortSectionsByCatalog([...prev, created]));
      setSaveStatus("saving");
      const { error } = await (supabase as any).from("ci_sections").insert(created);
      if (error) {
        setSaveStatus("error");
        setSaveErrorMsg(error.message);
        return null;
      }
      setSaveStatus("saved");
      return created;
    },
    [guideline?.id, supabase]
  );

  const removeSection = useCallback(async (sectionId: string) => {
    pendingUpdatesRef.current.delete(sectionId);
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    const result = await deleteCiSection(projectId, sectionId);
    if (!result.ok) {
      setSaveStatus("error");
      setSaveErrorMsg(result.error || "Failed to delete section");
    }
  }, [projectId]);

  const updateTheme = useCallback(
    async (partial: Partial<CITheme>) => {
      const next = ensureReadableTheme({
        ...(guideline?.theme || {}),
        ...partial,
        schemaVersion: CI_SCHEMA_VERSION,
      });
      setGuideline((prev: any) => ({ ...prev, theme: next }));
      if (!guideline?.id) return;
      setSaveStatus("saving");
      try {
        const { error } = await (supabase as any)
          .from("ci_guidelines")
          .update({ theme: next })
          .eq("id", guideline.id);
        if (error) throw error;
        setSaveStatus("saved");
      } catch (err: any) {
        setSaveStatus("error");
        setSaveErrorMsg(err.message);
      }
    },
    [guideline, supabase]
  );

  const addAsset = useCallback(
    async (asset: Partial<CIAsset>) => {
      setAssets((prev) => [...prev.filter((a) => a.id !== asset.id), asset]);
      if (!guideline?.id || !asset.id) return;
      setSaveStatus("saving");
      try {
        const { error } = await (supabase as any)
          .from("ci_assets")
          .upsert({ ...asset, guideline_id: guideline.id });
        if (error) throw error;
        setSaveStatus("saved");
      } catch (err: any) {
        setSaveStatus("error");
        setSaveErrorMsg(err.message);
      }
    },
    [guideline?.id, supabase]
  );

  const applyFigmaImport = useCallback(
    async (result: {
      sections: any[];
      assets: any[];
      theme: any;
      report: any;
      figma?: { fileKey?: string; fileName?: string; version?: string };
    }) => {
      if (result.sections?.length) setSections(sortSectionsByCatalog(result.sections));
      if (result.assets) setAssets(result.assets);
      setGuideline((g: any) =>
        g
          ? {
              ...g,
              theme: result.theme || g.theme,
              ...(result.figma?.fileKey
                ? {
                    figma_file_key: result.figma.fileKey,
                    figma_file_name: result.figma.fileName,
                    figma_file_version: result.figma.version,
                    figma_last_imported_at: new Date().toISOString(),
                  }
                : {}),
            }
          : g
      );
      const mig = await migrateCiGuidelineToSubmodules(projectId);
      if (mig.ok && mig.migrated) {
        if (mig.sections) setSections(sortSectionsByCatalog(mig.sections));
        if (mig.assets) setAssets(mig.assets);
      }
      setSaveStatus("saved");
      triggerToast("Figma import applied");
    },
    [projectId]
  );

  const sectionByType = useCallback(
    (type: string) => orderedSections.find((s) => s.section_type === type) || null,
    [orderedSections]
  );

  const assetById = useCallback(
    (id?: string | null) => (id ? assets.find((a) => a.id === id) || null : null),
    [assets]
  );

  const unassigned = useMemo(
    () => assets.filter((a) => a.section_id == null),
    [assets]
  );

  return {
    loading,
    loadError,
    migrating,
    guideline,
    setGuideline,
    sections: orderedSections,
    setSections,
    assets,
    setAssets,
    brandName,
    setBrandName,
    saveStatus,
    saveErrorMsg,
    flushPendingSaves,
    patchSectionData,
    ensureSection,
    insertSection,
    removeSection,
    updateTheme,
    addAsset,
    applyFigmaImport,
    reload: loadData,
    sectionByType,
    assetById,
    unassigned,
    theme: (guideline?.theme || {}) as CITheme,
  };
}

export function assetUrl(asset?: Partial<CIAsset> | null): string {
  const pub = String(asset?.public_url || "").trim();
  if (pub) return pub;
  const meta = (asset?.metadata || {}) as { pending_export?: boolean };
  if (meta.pending_export) return "";
  const path = String(asset?.storage_path || "").trim();
  if (!path || path.startsWith("figma://") || path.startsWith("pending/")) return "";
  return path;
}
