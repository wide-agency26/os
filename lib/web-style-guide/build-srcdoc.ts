import type { WebStyleGuideDocument } from "./document";

function normalizeAssetBaseUrl(input: string | null | undefined): string | null {
  const t = input?.trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith("//") ? `https:${t}` : t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.origin}${path === "" ? "" : path}/`;
  } catch {
    return null;
  }
}

/** First absolute stylesheet URL → site origin (helps legacy snapshots where meta.base was never stored). */
export function inferOriginBaseFromStylesheetHrefs(hrefs: string[]): string | null {
  for (const href of hrefs) {
    const t = href.trim();
    if (!t.startsWith("http://") && !t.startsWith("https://")) continue;
    try {
      return `${new URL(t).origin}/`;
    } catch {
      continue;
    }
  }
  return null;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Minimal nav shell so playbook preview works before Flowkit CSS loads. */
const STYLE_GUIDE_DOC_SHELL_CSS = `
body { margin: 0; }
.portal-sg-doc-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.85rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.96);
  position: sticky;
  top: 0;
  z-index: 50;
}
.portal-sg-doc-nav a {
  font: 500 13px/1.3 system-ui, sans-serif;
  color: rgba(15, 23, 42, 0.72);
  text-decoration: none;
}
.portal-sg-doc-nav a:hover { color: rgba(15, 23, 42, 1); }
`;

export function buildFlowkitSrcDoc(input: {
  bodyClass: string;
  fragment: string;
  stylesheetHrefs: string[];
  inlineHeadStyles: string;
  /** Resolve relative img/src and similar inside the fragment (srcDoc has no real URL otherwise). */
  baseHref?: string | null;
  /** Preconnect / font links copied from export */
  auxiliaryHeadLinkHtml?: string | null;
}): string {
  const resolvedBase =
    normalizeAssetBaseUrl(input.baseHref) ?? inferOriginBaseFromStylesheetHrefs(input.stylesheetHrefs);
  const baseTag = resolvedBase ? `<base href="${escapeAttr(resolvedBase)}" />` : "";

  const aux = (input.auxiliaryHeadLinkHtml ?? "").trim();

  const links = input.stylesheetHrefs
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}" />`)
    .join("\n");

  const styles = input.inlineHeadStyles ?? "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>${baseTag}${aux}${links}<style>${styles}</style></head><body class="${escapeAttr(input.bodyClass)}">${input.fragment}</body></html>`;
}

/** Compose iframe HTML from editable sections (nav + main), using the same assets as a Flowkit export. */
export function buildStyleGuideDocumentSrcDoc(doc: WebStyleGuideDocument): string {
  const ordered = [...doc.sections]
    .filter((s) => s.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const navLinks = ordered.map((s) => {
    const hash = s.id.startsWith("#") ? s.id : `#${s.id}`;
    const label = escapeHtmlText(s.navLabel || s.title);
    return `<a href="${escapeAttr(hash)}">${label}</a>`;
  });

  const mainInner = ordered.map((s) => s.bodyHtml).join("\n");
  const fragment = `<div class="sg_wrapper"><div class="sg_main-wrapper"><nav class="portal-sg-doc-nav sg_navigation" aria-label="Playbook sections">${navLinks.join(
    ""
  )}</nav><main id="main" class="sg_page-content">${mainInner}</main></div></div>`;

  const inline = [doc.inlineHeadStyles ?? "", STYLE_GUIDE_DOC_SHELL_CSS].filter(Boolean).join("\n");

  return buildFlowkitSrcDoc({
    bodyClass: doc.meta.bodyClass,
    fragment,
    stylesheetHrefs: doc.stylesheetHrefs,
    inlineHeadStyles: inline,
    baseHref: doc.meta.assetBaseUrl,
    auxiliaryHeadLinkHtml: doc.auxiliaryHeadLinkHtml,
  });
}
