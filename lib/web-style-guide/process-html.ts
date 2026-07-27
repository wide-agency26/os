import type { AnyNode, Element } from "domhandler";
import { load } from "cheerio";
import "server-only";

const JUNK_SELECTORS = [
  ".w-editor-bem-EditorApp",
  "#drag-ghost",
  "section.Toastify",
];

/** Normalize user-provided or inferred base so relative HTML/CSS URLs resolve inside srcDoc iframes. */
export function normalizeAssetBaseUrl(input: string | null | undefined): string | null {
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

function toAbsoluteStylesheetHref(href: string, baseOrigin?: string | null): string | null {
  const t = href.trim();
  if (!t) return null;
  if (t.startsWith("https://") || t.startsWith("http://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (!baseOrigin) return null;
  try {
    return new URL(t, baseOrigin).href;
  } catch {
    return null;
  }
}

/** Guess base URL from absolute URLs in export <head> so relative stylesheet paths resolve. */
export function inferAssetBaseOrigin(html: string): string | null {
  const $ = load(html);

  const pick = (href: string | undefined | null): string | null => {
    const abs = href?.trim();
    if (!abs || abs.startsWith("data:")) return null;
    const full = abs.startsWith("//") ? `https:${abs}` : abs;
    if (!full.startsWith("http://") && !full.startsWith("https://")) return null;
    try {
      const u = new URL(full);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return `${u.origin}/`;
    } catch {
      return null;
    }
  };

  let found: string | null = null;
  $("head link[rel='stylesheet'][href]").each((_, el) => {
    if (!found) found = pick($(el).attr("href"));
  });
  if (found) return found;

  $("head link[href]").each((_, el) => {
    if (found) return;
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    if (rel.includes("stylesheet")) return;
    found = pick($(el).attr("href"));
  });

  $("script[src]").each((_, el) => {
    if (!found) found = pick($(el).attr("src"));
  });

  return found;
}

function extractAuxiliaryHeadLinks(html: string): string {
  const $ = load(html);
  const seen = new Set<string>();
  const out: string[] = [];

  $("head link").each((_, el) => {
    const $el = $(el);
    const rel = ($el.attr("rel") ?? "").toLowerCase();
    const href = $el.attr("href")?.trim();
    if (!href || href.startsWith("javascript:") || href.startsWith("data:")) return;
    if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("//")) return;
    if (rel.includes("stylesheet")) return;

    const fontRelated =
      href.includes("fonts.googleapis.com") ||
      href.includes("fonts.gstatic.com") ||
      href.includes("use.typekit.net");
    const prefetch =
      rel.includes("preconnect") || rel.includes("dns-prefetch") || rel.includes("prefetch");
    if (!fontRelated && !prefetch) return;

    const serialized = $.html(el);
    if (seen.has(serialized)) return;
    seen.add(serialized);
    out.push(serialized);
  });

  return out.join("\n");
}

function stripDangerous(fragment: string): string {
  const $ = load(`<div id="__root">${fragment}</div>`);
  $("script").remove();
  $("iframe").remove();
  $("object").remove();
  $("embed").remove();

  const purgeAttrs = (el: AnyNode): void => {
    if (el.type !== "tag") return;
    const tag = el as Element;
    const node = $(tag);
    const attribs = tag.attribs;
    if (!attribs) return;
    for (const name of Object.keys(attribs)) {
      const lower = name.toLowerCase();
      if (lower.startsWith("on")) node.removeAttr(name);
      if (lower === "href" || lower === "src" || lower === "xlink:href") {
        const v = attribs[name]?.trim().toLowerCase() ?? "";
        if (v.startsWith("javascript:") || v.startsWith("data:text/html")) {
          node.removeAttr(name);
        }
      }
    }
  };

  $("*").each((_, el: AnyNode) => purgeAttrs(el));

  return $("#__root").html() ?? "";
}

function removeJunkFromFragment(fragment: string): string {
  const $ = load(`<div id="__root">${fragment}</div>`);
  for (const sel of JUNK_SELECTORS) {
    $(sel).remove();
  }
  return $("#__root").html() ?? fragment;
}

/** Sanitize an HTML fragment for safe embedding (scripts/iframes stripped, on* removed). */
export function sanitizeStyleGuideHtmlFragment(fragment: string): string {
  return stripDangerous(removeJunkFromFragment(fragment));
}

export type FlowkitExportAssets = {
  bodyClass: string;
  stylesheetHrefs: string[];
  inlineHeadStyles: string;
  assetBaseOrigin: string | null;
  auxiliaryHeadLinkHtml: string;
};

export function extractFlowkitExportAssets(html: string, baseOrigin?: string | null): FlowkitExportAssets {
  const inferred = inferAssetBaseOrigin(html);
  const resolvedBase = normalizeAssetBaseUrl(baseOrigin) ?? inferred;

  const $ = load(html);
  $("script").remove();

  const stylesheetHrefs: string[] = [];
  $("head link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    const abs = href ? toAbsoluteStylesheetHref(href, resolvedBase) : null;
    if (abs && !stylesheetHrefs.includes(abs)) stylesheetHrefs.push(abs);
  });

  const headStyles: string[] = [];
  $("head style").each((_, el) => {
    const c = $(el).html();
    if (c?.trim()) headStyles.push(c);
  });

  return {
    bodyClass: $("body").attr("class") ?? "",
    stylesheetHrefs,
    inlineHeadStyles: headStyles.join("\n"),
    assetBaseOrigin: resolvedBase,
    auxiliaryHeadLinkHtml: extractAuxiliaryHeadLinks(html),
  };
}

export type ProcessedFlowkitHtml = {
  bodyClass: string;
  fragment: string;
  stylesheetHrefs: string[];
  inlineHeadStyles: string;
};

export function processExportedStyleGuideHtml(
  html: string,
  baseOrigin?: string | null
): ProcessedFlowkitHtml {
  const resolvedBase = normalizeAssetBaseUrl(baseOrigin) ?? inferAssetBaseOrigin(html);

  const $ = load(html);

  $("script").remove();

  const stylesheetHrefs: string[] = [];
  $("head link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    const abs = href ? toAbsoluteStylesheetHref(href, resolvedBase) : null;
    if (abs && !stylesheetHrefs.includes(abs)) stylesheetHrefs.push(abs);
  });

  const headStyles: string[] = [];
  $("head style").each((_, el) => {
    const c = $(el).html();
    if (c?.trim()) headStyles.push(c);
  });

  const bodyClass = $("body").attr("class") ?? "";
  const inlineHeadStyles = headStyles.join("\n");

  let root = $(".sg_wrapper").first();
  if (!root.length) root = $(".sg_main-wrapper").first();
  if (!root.length) root = $("main.sg_page-content").first();

  let fragment: string;
  if (root.length) {
    fragment = $.html(root);
  } else {
    fragment = $.html($("body").contents());
  }

  fragment = removeJunkFromFragment(fragment);
  fragment = stripDangerous(fragment);

  return {
    bodyClass,
    fragment,
    stylesheetHrefs,
    inlineHeadStyles,
  };
}

export function looksLikeHtmlMarkup(raw: string): boolean {
  const s = raw.slice(0, 8000).trim().toLowerCase();
  return (
    s.startsWith("<!doctype") ||
    s.startsWith("<html") ||
    s.includes("<body") ||
    s.includes("sg_wrapper") ||
    s.includes("sg_main-wrapper") ||
    s.includes("<main")
  );
}
