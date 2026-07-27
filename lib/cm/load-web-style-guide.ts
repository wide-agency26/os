import { createClient } from "@/utils/supabase/server";
import { mergeStyleGuideDocument } from "@/lib/web-style-guide/document";
import type { WebStyleGuideDocument } from "@/lib/web-style-guide/document";

export type StyleGuideItemRow = {
  id: string;
  title: string;
  component_kind: string;
  staging_url: string | null;
  why_notes: string | null;
  dos: string | null;
  donts: string | null;
  sort_order: number;
  screenshot_storage_path: string | null;
};

export type WebStyleGuideWorkspaceData = {
  clientId: string;
  clientLabel: string;
  items: StyleGuideItemRow[];
  itemsError: string | null;
  snapshotError: string | null;
  mergedDoc: WebStyleGuideDocument;
  legacyHtml: string;
  legacyBodyClass: string;
  legacyStylesheetHrefs: string[];
  legacyInlineHeadStyles: string;
  snapshotUpdatedAt: string | null;
};

export async function loadWebStyleGuideWorkspace(
  clientId: string
): Promise<WebStyleGuideWorkspaceData | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, company_name, role")
    .eq("id", clientId)
    .maybeSingle();

  if (!profile || profile.role !== "client") return null;

  const clientLabel =
    profile.company_name?.trim() || profile.full_name?.trim() || "Client";

  const { data: itemsRaw, error: itemsError } = await supabase
    .from("web_style_guide_items")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  const snap = await supabase
    .from("web_style_guide_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  const snapshot = snap.data;
  const stylesheetHrefs = Array.isArray(snapshot?.stylesheet_hrefs)
    ? (snapshot.stylesheet_hrefs as unknown[]).filter(
        (x): x is string => typeof x === "string"
      )
    : [];

  const docTitleFallback = clientLabel;
  const mergedDoc = mergeStyleGuideDocument(
    snapshot?.style_guide_document,
    docTitleFallback
  );

  return {
    clientId,
    clientLabel,
    items: (itemsRaw as StyleGuideItemRow[]) ?? [],
    itemsError: itemsError?.message ?? null,
    snapshotError: snap.error?.message ?? null,
    mergedDoc,
    legacyHtml: snapshot?.html_fragment ?? "",
    legacyBodyClass: snapshot?.body_class ?? "",
    legacyStylesheetHrefs: stylesheetHrefs,
    legacyInlineHeadStyles: snapshot?.inline_head_styles ?? "",
    snapshotUpdatedAt: snapshot?.updated_at ?? null,
  };
}
