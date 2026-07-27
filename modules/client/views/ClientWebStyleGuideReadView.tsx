import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { publicStorageUrl } from "@/lib/storage-public-url";
import { FlowkitStyleGuideFrame } from "@/app/components/web-style-guide/FlowkitStyleGuideFrame";
import { StyleGuideDocumentFrame } from "@/app/components/web-style-guide/StyleGuideDocumentFrame";
import { mergeStyleGuideDocument } from "@/lib/web-style-guide/document";
import type { WideAccess } from "@/lib/wide-os/types";
import { ModuleScaffold } from "@/modules/_shared/ModuleScaffold";

const BUCKET = "client-vault";

export async function ClientWebStyleGuideReadView({ access }: { access: WideAccess }) {
  const clientId = access.clientId!;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("web_style_guide_items")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true });

  const snapRes = await supabase
    .from("web_style_guide_snapshots")
    .select("body_class, html_fragment, stylesheet_hrefs, inline_head_styles, style_guide_document, pdf_notes")
    .eq("client_id", clientId)
    .maybeSingle();

  const snapshot = snapRes.data;
  const stylesheetHrefs = Array.isArray(snapshot?.stylesheet_hrefs)
    ? snapshot.stylesheet_hrefs.filter((x): x is string => typeof x === "string")
    : [];

  const playbookDoc = mergeStyleGuideDocument(snapshot?.style_guide_document, "Style guide");
  const hasStructured = playbookDoc.sections.some((s) => s.visible && s.bodyHtml.trim().length > 0);
  const hasLegacy = Boolean(snapshot?.html_fragment?.trim());

  return (
    <ModuleScaffold access={access} title="Web style guide" description="Read-only UI specs from your WIDE team.">
      {error ? <p className="text-sm text-danger">{error.message}</p> : null}
      {hasStructured ? (
        <StyleGuideDocumentFrame doc={playbookDoc} className="w-full min-h-[70vh] rounded-2xl border border-border bg-white" />
      ) : hasLegacy ? (
        <FlowkitStyleGuideFrame
          bodyClass={snapshot?.body_class ?? ""}
          fragment={snapshot?.html_fragment ?? ""}
          stylesheetHrefs={stylesheetHrefs}
          inlineHeadStyles={snapshot?.inline_head_styles ?? ""}
          className="w-full min-h-[70vh] rounded-2xl border border-border bg-white"
        />
      ) : (
        <p className="text-sm text-text-secondary">Your web playbook will appear here once published.</p>
      )}
    </ModuleScaffold>
  );
}
