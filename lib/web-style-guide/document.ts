export type WebStyleGuideNavGroup = "Foundations" | "Components" | "Other";

export interface WebStyleGuideSection {
  id: string;
  navLabel: string;
  navGroup: WebStyleGuideNavGroup;
  title: string;
  subtitle: string;
  bodyHtml: string;
  sortOrder: number;
  visible: boolean;
}

/** Structured playbook (editable blocks), stored in `web_style_guide_snapshots.style_guide_document`. */
export interface WebStyleGuideDocument {
  version: 1;
  meta: {
    title: string;
    versionLabel: string;
    bodyClass: string;
    /** Origin + slash (e.g. https://project.webflow.io/) so relative img/src and CSS URLs resolve in iframe preview */
    assetBaseUrl?: string;
  };
  stylesheetHrefs: string[];
  inlineHeadStyles: string;
  /** Serialized safe <link> tags from export head (preconnect, fonts) — improves font/icon loading */
  auxiliaryHeadLinkHtml?: string;
  sections: WebStyleGuideSection[];
}

const MAX_SECTION_HTML = 280_000;
const MAX_INLINE = 400_000;
const NAV_GROUPS: WebStyleGuideNavGroup[] = ["Foundations", "Components", "Other"];

function isNavGroup(s: string): s is WebStyleGuideNavGroup {
  return NAV_GROUPS.includes(s as WebStyleGuideNavGroup);
}

export function createEmptyStyleGuideDocument(): WebStyleGuideDocument {
  return {
    version: 1,
    meta: { title: "Style Guide", versionLabel: "1.0", bodyClass: "" },
    stylesheetHrefs: [],
    inlineHeadStyles: "",
    sections: [],
  };
}

export function isWebStyleGuideDocument(v: unknown): v is WebStyleGuideDocument {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!o.meta || typeof o.meta !== "object") return false;
  const m = o.meta as Record<string, unknown>;
  if (typeof m.title !== "string" || typeof m.versionLabel !== "string" || typeof m.bodyClass !== "string") {
    return false;
  }
  if (m.assetBaseUrl !== undefined && typeof m.assetBaseUrl !== "string") return false;
  if (!Array.isArray(o.sections)) return false;
  if (!Array.isArray(o.stylesheetHrefs)) return false;
  if (typeof o.inlineHeadStyles !== "string") return false;
  if (o.auxiliaryHeadLinkHtml !== undefined && typeof o.auxiliaryHeadLinkHtml !== "string") return false;
  for (const s of o.sections) {
    if (!s || typeof s !== "object") return false;
    const sec = s as Record<string, unknown>;
    if (typeof sec.id !== "string" || typeof sec.navLabel !== "string") return false;
    if (typeof sec.navGroup !== "string" || !isNavGroup(sec.navGroup)) return false;
    if (typeof sec.title !== "string" || typeof sec.subtitle !== "string") return false;
    if (typeof sec.bodyHtml !== "string") return false;
    if (typeof sec.sortOrder !== "number" || typeof sec.visible !== "boolean") return false;
  }
  return true;
}

export function storedStyleGuideHasContent(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.sections) && o.sections.length > 0) return true;
  if (typeof o.inlineHeadStyles === "string" && o.inlineHeadStyles.trim().length > 0) return true;
  return false;
}

export function mergeStyleGuideDocument(raw: unknown, titleFallback: string): WebStyleGuideDocument {
  const empty = createEmptyStyleGuideDocument();
  empty.meta.title = titleFallback;
  if (!storedStyleGuideHasContent(raw)) {
    return empty;
  }
  if (!raw || typeof raw !== "object") {
    return empty;
  }
  const o = raw as Record<string, unknown>;
  const meta = o.meta as Record<string, unknown> | undefined;
  empty.meta = {
    title: typeof meta?.title === "string" ? meta.title : titleFallback,
    versionLabel: typeof meta?.versionLabel === "string" ? meta.versionLabel : "1.0",
    bodyClass: typeof meta?.bodyClass === "string" ? meta.bodyClass : "",
    ...(typeof meta?.assetBaseUrl === "string" && meta.assetBaseUrl.trim()
      ? { assetBaseUrl: meta.assetBaseUrl.trim() }
      : {}),
  };
  empty.stylesheetHrefs = Array.isArray(o.stylesheetHrefs)
    ? o.stylesheetHrefs.filter((x): x is string => typeof x === "string")
    : [];
  empty.inlineHeadStyles =
    typeof o.inlineHeadStyles === "string"
      ? o.inlineHeadStyles.slice(0, MAX_INLINE)
      : "";
  empty.auxiliaryHeadLinkHtml =
    typeof o.auxiliaryHeadLinkHtml === "string" ? o.auxiliaryHeadLinkHtml.slice(0, 120_000) : "";

  if (Array.isArray(o.sections)) {
    empty.sections = o.sections.map((s, i) => {
      const sec = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const navGroup =
        typeof sec.navGroup === "string" && isNavGroup(sec.navGroup) ? sec.navGroup : "Other";
      return {
        id: typeof sec.id === "string" && sec.id.trim() ? sec.id.trim() : `section-${i}`,
        navLabel: typeof sec.navLabel === "string" ? sec.navLabel : `Section ${i + 1}`,
        navGroup,
        title: typeof sec.title === "string" ? sec.title : `Section ${i + 1}`,
        subtitle: typeof sec.subtitle === "string" ? sec.subtitle : "",
        bodyHtml:
          typeof sec.bodyHtml === "string" ? sec.bodyHtml.slice(0, MAX_SECTION_HTML) : "",
        sortOrder: typeof sec.sortOrder === "number" ? sec.sortOrder : i,
        visible: typeof sec.visible === "boolean" ? sec.visible : true,
      };
    });
  }

  return empty;
}
