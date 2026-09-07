export function sowFamilyKey(sow: {
  id: string;
  version_root_id?: string | null;
}): string {
  return sow.version_root_id || sow.id;
}

export function stripSowVersionSuffix(title: string): string {
  return title.replace(/\s*\(v\d+\)\s*$/i, "").trim();
}

export function titleWithSowVersion(title: string, versionNumber: number): string {
  const base = stripSowVersionSuffix(title) || "Scope of Work";
  if (versionNumber <= 1) return base;
  return `${base} (v${versionNumber})`;
}

export type SowVersionPeer = {
  id: string;
  title: string;
  version_number: number;
  status: string;
  public_slug: string | null;
};
