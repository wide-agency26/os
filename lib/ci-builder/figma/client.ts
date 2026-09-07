/**
 * Extended Figma REST helpers for variables, styles, images, components.
 */

export class FigmaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FigmaApiError";
    this.status = status;
  }
}

type FigmaFetchInit = RequestInit & { preferPat?: boolean };

function extraHeaders(init?: RequestInit): Record<string, string> {
  const extra: Record<string, string> = {};
  if (!init?.headers) return extra;
  new Headers(init.headers).forEach((value, key) => {
    extra[key] = value;
  });
  return extra;
}

function looksLikeFigmaPat(token: string): boolean {
  return token.startsWith("figd_") || token.startsWith("figd-");
}

async function figmaFetch<T>(
  path: string,
  accessToken: string,
  init?: FigmaFetchInit
): Promise<T> {
  // PATs must use X-Figma-Token. OAuth uses Authorization: Bearer.
  // Newer Figma PATs are not always figd_-prefixed, so retry the other
  // scheme on 401/403 instead of failing the first guess.
  const { preferPat, ...fetchInit } = init || {};
  const token = accessToken.trim();
  const extra = extraHeaders(fetchInit);
  const patHeaders = { "X-Figma-Token": token, ...extra };
  const oauthHeaders = { Authorization: `Bearer ${token}`, ...extra };
  const attempts =
    preferPat || looksLikeFigmaPat(token)
      ? [patHeaders, oauthHeaders]
      : [oauthHeaders, patHeaders];

  let lastStatus = 500;
  let lastDetail = "Unknown Figma error";

  for (let i = 0; i < attempts.length; i++) {
    const res = await fetch(`https://api.figma.com/v1${path}`, {
      ...fetchInit,
      headers: attempts[i],
    });
    if (res.ok) return res.json() as Promise<T>;

    lastStatus = res.status;
    lastDetail = res.statusText;
    try {
      const body = await res.json();
      lastDetail = body?.err || body?.message || JSON.stringify(body);
    } catch {
      /* ignore */
    }

    const tryOtherAuth = i === 0 && (res.status === 401 || res.status === 403);
    if (!tryOtherAuth) break;
  }

  throw new FigmaApiError(`Figma API ${path}: ${lastDetail}`, lastStatus);
}

export type FigmaProject = { id: number | string; name: string };
export type FigmaProjectFile = {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified?: string;
};

export type FigmaBoundVar = { type?: string; id?: string };

export type FigmaPaint = {
  type?: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
  boundVariables?: { color?: FigmaBoundVar };
};

export type FigmaTypeStyle = {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  italic?: boolean;
  fontStyle?: string;
  lineHeightPx?: number;
  lineHeightPercentFontSize?: number;
  letterSpacing?: number;
  textCase?: string;
};

export type FigmaFileNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaFileNode[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  style?: FigmaTypeStyle;
  styles?: { fill?: string; text?: string; stroke?: string; effect?: string };
  boundVariables?: {
    fills?: FigmaBoundVar | FigmaBoundVar[];
    strokes?: FigmaBoundVar | FigmaBoundVar[];
  };
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  characters?: string;
  componentId?: string;
  componentProperties?: Record<string, { value?: string; type?: string }>;
  variantProperties?: Record<string, string>;
};

export type FigmaStyleMeta = {
  key?: string;
  name: string;
  styleType: string;
  description?: string;
};

export type FigmaComponentMeta = {
  key?: string;
  name: string;
  description?: string;
  componentSetId?: string;
  remote?: boolean;
};

export type FigmaFileResponse = {
  name: string;
  lastModified?: string;
  version?: string;
  document: FigmaFileNode;
  components?: Record<string, FigmaComponentMeta>;
  componentSets?: Record<string, { key?: string; name: string; description?: string }>;
  styles?: Record<string, FigmaStyleMeta>;
};

export type FigmaVariable = {
  id: string;
  name: string;
  key?: string;
  variableCollectionId: string;
  resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  valuesByMode: Record<string, unknown>;
};

export type FigmaVariableCollection = {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
  defaultModeId?: string;
  variableIds: string[];
};

export type FigmaVariablesResponse = {
  status?: number;
  error?: boolean;
  meta?: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
  /** Some Figma payloads hoist collections to the root. */
  variables?: Record<string, FigmaVariable>;
  variableCollections?: Record<string, FigmaVariableCollection>;
};

export function readVariablesMeta(variables: FigmaVariablesResponse | null): {
  variables: Record<string, FigmaVariable>;
  variableCollections: Record<string, FigmaVariableCollection>;
} | null {
  if (!variables) return null;
  const vars = variables.meta?.variables || variables.variables;
  const colls =
    variables.meta?.variableCollections || variables.variableCollections;
  if (!vars) return null;
  return { variables: vars, variableCollections: colls || {} };
}

export async function getFigmaMe(accessToken: string, preferPat = false) {
  return figmaFetch<{ id: string | number; email?: string; handle?: string }>(
    "/me",
    accessToken,
    preferPat ? { preferPat: true } : undefined
  );
}

export async function getTeamProjects(accessToken: string, teamId: string) {
  return figmaFetch<{ name?: string; projects: FigmaProject[] }>(
    `/teams/${encodeURIComponent(teamId)}/projects`,
    accessToken
  );
}

export async function getProjectFiles(accessToken: string, projectId: string) {
  return figmaFetch<{ name?: string; files: FigmaProjectFile[] }>(
    `/projects/${encodeURIComponent(projectId)}/files`,
    accessToken
  );
}

export async function getFigmaFile(
  accessToken: string,
  fileKey: string,
  opts?: { depth?: number }
) {
  const params = new URLSearchParams();
  if (opts?.depth != null) params.set("depth", String(opts.depth));
  const qs = params.toString();
  return figmaFetch<FigmaFileResponse>(
    `/files/${encodeURIComponent(fileKey)}${qs ? `?${qs}` : ""}`,
    accessToken
  );
}

export async function getFigmaFileMeta(accessToken: string, fileKey: string) {
  return figmaFetch<{
    file?: { name?: string; last_modified?: string; version?: string };
    name?: string;
    last_modified?: string;
    version?: string;
  }>(`/files/${encodeURIComponent(fileKey)}/meta`, accessToken);
}

async function getVariablesEndpoint(
  accessToken: string,
  fileKey: string,
  kind: "local" | "published"
): Promise<FigmaVariablesResponse | null> {
  const result = await getVariablesWithReason(accessToken, fileKey, kind);
  return result.data;
}

export async function getVariablesWithReason(
  accessToken: string,
  fileKey: string,
  kind: "local" | "published" = "local"
): Promise<{
  data: FigmaVariablesResponse | null;
  unavailableReason: string | null;
}> {
  try {
    const data = await figmaFetch<FigmaVariablesResponse>(
      `/files/${encodeURIComponent(fileKey)}/variables/${kind}`,
      accessToken
    );
    return { data, unavailableReason: null };
  } catch (err) {
    if (err instanceof FigmaApiError && (err.status === 403 || err.status === 404)) {
      const planBlocked =
        err.status === 403 ||
        /plan|enterprise|limited|scope/i.test(err.message || "");
      return {
        data: null,
        unavailableReason: planBlocked
          ? "Figma Variables REST is Enterprise-only. On Pro, copy Brand Colors with the WIDE OS plugin and paste them here."
          : "Variables endpoint not found for this file.",
      };
    }
    throw err;
  }
}

/** Enterprise / org — may 403 on free plans. */
export async function getLocalVariables(
  accessToken: string,
  fileKey: string
): Promise<FigmaVariablesResponse | null> {
  return getVariablesEndpoint(accessToken, fileKey, "local");
}

/** Published library variables for the file — fallback when local vars are empty. */
export async function getPublishedVariables(
  accessToken: string,
  fileKey: string
): Promise<FigmaVariablesResponse | null> {
  return getVariablesEndpoint(accessToken, fileKey, "published");
}

export async function renderFigmaImages(
  accessToken: string,
  fileKey: string,
  nodeIds: string[],
  opts?: { format?: "png" | "svg" | "jpg"; scale?: number }
): Promise<Record<string, string | null>> {
  if (!nodeIds.length) return {};
  const format = opts?.format || "png";
  const scale = opts?.scale ?? 2;
  const chunkSize = 40;
  const out: Record<string, string | null> = {};

  for (let i = 0; i < nodeIds.length; i += chunkSize) {
    const chunk = nodeIds.slice(i, i + chunkSize);
    const params = new URLSearchParams({
      ids: chunk.join(","),
      format,
      scale: String(scale),
    });
    const data = await figmaFetch<{ images: Record<string, string | null> }>(
      `/images/${encodeURIComponent(fileKey)}?${params}`,
      accessToken
    );
    Object.assign(out, data.images || {});
  }
  return out;
}

export function parseFigmaFileKey(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[a-zA-Z0-9]{10,}$/.test(raw) && !raw.includes("/")) return raw;

  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) =>
      ["file", "design", "proto", "board", "slides"].includes(p)
    );
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  } catch {
    /* not a URL */
  }
  return null;
}

export function parseFigmaTeamId(input: string): string | null {
  const raw = input.trim();
  if (/^\d+$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    const teamIdx = parts.findIndex((p) => p === "team");
    if (teamIdx >= 0 && parts[teamIdx + 1] && /^\d+$/.test(parts[teamIdx + 1])) {
      return parts[teamIdx + 1];
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function figmaColorToHex(color: {
  r: number;
  g: number;
  b: number;
  a?: number;
}): string {
  const r = Math.round(Math.min(1, Math.max(0, color.r)) * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(Math.min(1, Math.max(0, color.g)) * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(Math.min(1, Math.max(0, color.b)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`;
}

export function tokenNameToCssVar(name: string): string {
  const slug = name
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
  return `--${slug}`;
}
