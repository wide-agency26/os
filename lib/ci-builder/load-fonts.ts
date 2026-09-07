import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";

const GOOGLE_FAMILIES = new Set(
  [
    "Public Sans",
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Poppins",
    "Source Sans 3",
    "Source Sans Pro",
    "Nunito",
    "Nunito Sans",
    "Raleway",
    "Ubuntu",
    "Playfair Display",
    "Merriweather",
    "Work Sans",
    "DM Sans",
    "DM Serif Display",
    "Space Grotesk",
    "Space Mono",
    "Manrope",
    "Outfit",
    "Plus Jakarta Sans",
    "IBM Plex Sans",
    "IBM Plex Serif",
    "IBM Plex Mono",
    "Source Serif 4",
    "Libre Baskerville",
    "Libre Franklin",
    "PT Sans",
    "PT Serif",
    "Noto Sans",
    "Noto Serif",
    "Barlow",
    "Karla",
    "Rubik",
    "Mulish",
    "Cabin",
    "Josefin Sans",
    "Archivo",
    "Figtree",
    "Sora",
    "Urbanist",
    "Instrument Sans",
    "Instrument Serif",
    "Syne",
    "Fraunces",
    "Newsreader",
    "Schibsted Grotesk",
    "Geist",
    "Geist Mono",
    "Cormorant Garamond",
    "Oswald",
    "Bebas Neue",
    "Anton",
    "Inconsolata",
    "Fira Sans",
    "Fira Code",
    "JetBrains Mono",
    "Material Icons",
  ].map((n) => n.toLowerCase())
);

export type FontFaceSpec = {
  family: string;
  url: string;
  weight?: string;
  style?: string;
};

export type FontLoadPlan = {
  families: string[];
  googleHref: string | null;
  faceCss: string;
};

function quoteFamily(name: string): string {
  const t = name.trim().replace(/['"]/g, "");
  return /\s/.test(t) ? `'${t}'` : t;
}

function googleFamilyParam(name: string): string {
  return name.trim().replace(/\s+/g, "+");
}

const DEFAULT_GOOGLE_WEIGHTS = [400, 500, 700];

function parseFontWeight(raw: unknown): number | null {
  const n = parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(n) || n < 100 || n > 900) return null;
  return Math.round(n / 100) * 100;
}

function collectGoogleAxes(
  theme?: CITheme | null,
  sections?: Partial<CISection>[] | null
): { weights: number[]; italic: boolean } {
  const weights = new Set<number>(DEFAULT_GOOGLE_WEIGHTS);
  let italic = false;

  const consider = (rawWeight?: unknown, rawStyle?: unknown) => {
    const w = parseFontWeight(rawWeight);
    if (w) weights.add(w);
    const style = `${rawStyle ?? ""} ${rawWeight ?? ""}`.toLowerCase();
    if (style.includes("italic") || style.includes("oblique")) italic = true;
  };

  const walk = (value: unknown, depth = 0) => {
    if (value == null || depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (typeof value !== "object") return;
    const rec = value as Record<string, unknown>;
    consider(rec.fontWeight ?? rec.weight, rec.fontStyle ?? rec.style);
    for (const nested of Object.values(rec)) {
      if (nested && typeof nested === "object") walk(nested, depth + 1);
    }
  };

  walk(theme);
  for (const sec of sections || []) walk(sec.data);
  return { weights: [...weights].sort((a, b) => a - b), italic };
}

function googleFamilyQuery(
  name: string,
  axes: { weights: number[]; italic: boolean }
): string {
  const family = googleFamilyParam(name);
  const weights = axes.weights.length ? axes.weights : DEFAULT_GOOGLE_WEIGHTS;
  if (!axes.italic) return `family=${family}:wght@${weights.join(";")}`;
  const pairs = [
    ...weights.map((w) => `0,${w}`),
    ...weights.map((w) => `1,${w}`),
  ];
  return `family=${family}:ital,wght@${pairs.join(";")}`;
}

function fontFormat(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".woff2")) return "woff2";
  if (path.endsWith(".woff")) return "woff";
  if (path.endsWith(".otf")) return "opentype";
  if (path.endsWith(".ttf")) return "truetype";
  return "woff2";
}

export function namedThemeFonts(theme?: CITheme | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string | null) => {
    const name = String(raw || "")
      .split(",")[0]
      ?.replace(/['"]/g, "")
      .trim();
    if (!name || /system-ui|sans-serif|serif|monospace|apple-system/i.test(name)) {
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  add(theme?.primaryFont);
  add(theme?.secondaryFont);
  add(theme?.tertiaryFont);
  add(theme?.fontFamily);
  for (const f of theme?.availableFonts || []) add(f);
  return out;
}

export function collectFontFaces(
  assets?: Partial<CIAsset>[] | null,
  sections?: Partial<CISection>[] | null
): FontFaceSpec[] {
  const faces: FontFaceSpec[] = [];
  const seen = new Set<string>();

  const push = (spec: FontFaceSpec) => {
    if (!spec.family || !spec.url) return;
    const key = `${spec.family}|${spec.url}|${spec.weight || ""}|${spec.style || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    faces.push(spec);
  };

  for (const asset of assets || []) {
    const url = String(asset.public_url || "").trim();
    if (!url) continue;
    const kind = String(asset.kind || "").toLowerCase();
    const path = String(asset.storage_path || url).toLowerCase();
    const isFont =
      kind === "font" ||
      Boolean((asset.metadata as { font?: boolean } | undefined)?.font) ||
      /\.(woff2?|ttf|otf)(\?|$)/.test(path);
    if (!isFont) continue;
    push({
      family: String(asset.label || "BrandFont").replace(/['"]/g, ""),
      url,
      weight: String((asset.metadata as { weight?: string } | undefined)?.weight || "normal"),
      style: String((asset.metadata as { style?: string } | undefined)?.style || "normal"),
    });
  }

  for (const sec of sections || []) {
    const data = (sec.data || {}) as {
      fontFamily?: string;
      fontFiles?: {
        assetId?: string;
        label?: string;
        weight?: string;
        style?: string;
      }[];
    };
    const family = String(data.fontFamily || "").trim();
    for (const row of data.fontFiles || []) {
      const asset = (assets || []).find((a) => a.id === row.assetId);
      const url = String(asset?.public_url || "").trim();
      if (!url) continue;
      push({
        family: (family || row.label || "BrandFont").replace(/['"]/g, ""),
        url,
        weight: row.weight || "normal",
        style: row.style || "normal",
      });
    }
  }

  return faces;
}

export function buildFontLoadPlan(
  theme?: CITheme | null,
  assets?: Partial<CIAsset>[] | null,
  sections?: Partial<CISection>[] | null
): FontLoadPlan {
  const faces = collectFontFaces(assets, sections);
  const faceFamilies = new Set(faces.map((f) => f.family.toLowerCase()));
  const families = namedThemeFonts(theme);
  const googleNames = families.filter(
    (name) =>
      !faceFamilies.has(name.toLowerCase()) &&
      GOOGLE_FAMILIES.has(name.toLowerCase())
  );

  const axes = collectGoogleAxes(theme, sections);
  const googleHref = googleNames.length
    ? `https://fonts.googleapis.com/css2?${googleNames
        .map((name) => googleFamilyQuery(name, axes))
        .join("&")}&display=swap`
    : null;

  const faceCss = faces
    .map((face) => {
      return `@font-face{font-family:${quoteFamily(face.family)};src:url('${face.url}') format('${fontFormat(face.url)}');font-weight:${face.weight || "normal"};font-style:${face.style || "normal"};font-display:swap;}`;
    })
    .join("\n");

  return { families, googleHref, faceCss };
}

export function isKnownGoogleFont(family: string): boolean {
  return GOOGLE_FAMILIES.has(family.trim().toLowerCase());
}

export async function checkNamedFontLoaded(family: string): Promise<boolean> {
  if (typeof document === "undefined" || !family.trim()) return false;
  const name = family.trim().replace(/['"]/g, "");
  try {
    await document.fonts.load(`16px "${name}"`);
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
  if (document.fonts.check(`16px "${name}"`)) return true;
  return Array.from(document.fonts).some(
    (f) => f.family.replace(/['"]/g, "").toLowerCase() === name.toLowerCase()
  );
}
