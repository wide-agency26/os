import type { AnyNode, Element } from "domhandler";
import { load } from "cheerio";
import "server-only";

import type { WebStyleGuideDocument, WebStyleGuideNavGroup, WebStyleGuideSection } from "./document";
import { extractFlowkitExportAssets, sanitizeStyleGuideHtmlFragment } from "./process-html";

function inferNavGroup(id: string): WebStyleGuideNavGroup {
  const lo = id.toLowerCase();
  if (lo === "foundation" || lo.startsWith("foundation")) return "Foundations";
  if (lo === "components" || lo.startsWith("components")) return "Components";
  return "Other";
}

function pickTitle(
  $: ReturnType<typeof load>,
  el: AnyNode,
  navMap: Map<string, string>,
  rawId: string
): string {
  if (navMap.has(rawId)) return navMap.get(rawId)!;
  if (el.type !== "tag") return humanizeId(rawId);
  const $el = $(el);
  const heading = $el
    .find(
      ".sg_section-heading-wrapper .paragraph_large, .sg_section-heading-wrapper h2, h1.heading_hero, h2.heading_hero, h2.paragraph_large, h2, .paragraph_large"
    )
    .first();
  const t = heading.text().replace(/\s+/g, " ").trim();
  if (t) return t;
  return humanizeId(rawId);
}

function humanizeId(id: string): string {
  return id
    .replace(/^Foundation-?/i, "")
    .replace(/^Components-?/i, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Section";
}

export function buildStyleGuideDocumentFromHtml(
  html: string,
  baseOrigin?: string | null
): WebStyleGuideDocument {
  const assets = extractFlowkitExportAssets(html, baseOrigin);
  const $ = load(html);
  $("script").remove();

  const navMap = new Map<string, string>();
  $(".sg_navigation a[href^='#']").each((_, a) => {
    const href = $(a).attr("href");
    if (!href || href === "#") return;
    const id = decodeURIComponent(href.replace(/^#/, "").trim());
    const label = $(a).text().replace(/\s+/g, " ").trim();
    if (id && label) navMap.set(id, label);
  });

  const main = $("main#main.sg_page-content, main.sg_page-content, main#main").first();
  const root = main.length ? main : $(".sg_page-content").first();

  const sections: WebStyleGuideSection[] = [];
  const seenIds = new Set<string>();

  if (root.length) {
    root.find("section[id]").each((idx, el) => {
      if (el.type !== "tag") return;
      const rawId = (el as Element).attribs?.id?.trim();
      if (!rawId || rawId.startsWith("w-")) return;

      let id = rawId;
      if (seenIds.has(id)) id = `${rawId}-${idx}`;
      seenIds.add(id);

      const htmlChunk = $.html(el);
      const bodyHtml = sanitizeStyleGuideHtmlFragment(htmlChunk);
      if (!bodyHtml.replace(/\s/g, "").length) return;

      const title = pickTitle($, el, navMap, rawId);
      const navLabel = navMap.get(rawId) ?? title;

      sections.push({
        id,
        navLabel,
        navGroup: inferNavGroup(rawId),
        title,
        subtitle: "",
        bodyHtml,
        sortOrder: sections.length,
        visible: true,
      });
    });
  }

  if (sections.length === 0 && root.length) {
    for (const key of ["Foundation", "Components"]) {
      const el = root.find(`> div#${key}`).first();
      if (!el.length) continue;
      const bodyHtml = sanitizeStyleGuideHtmlFragment($.html(el));
      if (!bodyHtml.trim()) continue;
      const id = key;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      sections.push({
        id,
        navLabel: key === "Foundation" ? "Foundations" : "Components",
        navGroup: key === "Foundation" ? "Foundations" : "Components",
        title: key === "Foundation" ? "Foundations" : "Components",
        subtitle: "",
        bodyHtml,
        sortOrder: sections.length,
        visible: true,
      });
    }
  }

  if (sections.length === 0 && root.length) {
    const inner = root.html() ?? "";
    const bodyHtml = sanitizeStyleGuideHtmlFragment(inner);
    if (bodyHtml.trim()) {
      sections.push({
        id: "playbook",
        navLabel: "Playbook",
        navGroup: "Other",
        title: "Style guide",
        subtitle: "",
        bodyHtml,
        sortOrder: 0,
        visible: true,
      });
    }
  }

  const metaTitle = navMap.get("Foundation")?.includes("Foundation")
    ? "Style Guide"
    : "Style Guide";

  return {
    version: 1,
    meta: {
      title: metaTitle,
      versionLabel: "1.0",
      bodyClass: assets.bodyClass,
      ...(assets.assetBaseOrigin ? { assetBaseUrl: assets.assetBaseOrigin } : {}),
    },
    stylesheetHrefs: assets.stylesheetHrefs,
    inlineHeadStyles: assets.inlineHeadStyles.slice(0, 400_000),
    auxiliaryHeadLinkHtml: assets.auxiliaryHeadLinkHtml,
    sections,
  };
}
