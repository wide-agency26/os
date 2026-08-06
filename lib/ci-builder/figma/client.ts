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

async function figmaFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`https://api.figma.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.err || body?.message || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new FigmaApiError(`Figma API ${path}: ${detail}`, res.status);
  }

  return res.json() as Promise<T>;
}

export type FigmaProject = { id: number | string; name: string };
export type FigmaProjectFile = {
  key: string;
  name: string;
  thumbnail_url?: string;
  last_modified?: string;
};

export type FigmaPaint = {
  type?: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
};

export type FigmaTypeStyle = {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
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
};

export async function getFigmaMe(accessToken: string) {
  return figmaFetch<{ id: string | number; email?: string; handle?: string }>(
    "/me",
    accessToken
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

/** Enterprise / org — may 403 on free plans. */
export async function getLocalVariables(
  accessToken: string,
  fileKey: string
): Promise<FigmaVariablesResponse | null> {
  try {
    return await figmaFetch<FigmaVariablesResponse>(
      `/files/${encodeURIComponent(fileKey)}/variables/local`,
      accessToken
    );
  } catch (err) {
    if (err instanceof FigmaApiError && (err.status === 403 || err.status === 404)) {
      return null;
    }
    throw err;
  }
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
