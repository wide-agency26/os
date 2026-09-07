export function appOrigin(req: Request): string {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://127.0.0.1:3000";
}

export function printPath(input: {
  kind: "ci" | "ci_draft" | "report";
  slug?: string;
  projectId?: string;
  category?: string;
}): string {
  if (input.kind === "ci" && input.slug) {
    return `/g/${encodeURIComponent(input.slug)}/print`;
  }
  if ((input.kind === "ci" || input.kind === "ci_draft") && input.projectId) {
    return `/app/projects/${encodeURIComponent(input.projectId)}/ci-builder/print`;
  }
  const sp = new URLSearchParams();
  if (input.projectId) sp.set("project", input.projectId);
  if (input.category) sp.set("category", input.category);
  const q = sp.toString();
  return q ? `/app/reports/print?${q}` : "/app/reports/print";
}
