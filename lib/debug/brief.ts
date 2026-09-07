import type { DebugReportInput, DebugSnapshot } from "@/lib/debug/types";

function line(label: string, value: string | null | undefined): string {
  const v = (value || "").trim();
  return v ? `- **${label}:** ${v}` : "";
}

function block(title: string, value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "";
  return `## ${title}\n\n${v}\n`;
}

function codeList(items: string[]): string {
  if (!items.length) return "_none_";
  return items.map((item) => `- \`${item}\``).join("\n");
}

export function compileDebugBrief(
  input: DebugReportInput,
  extras: {
    reporterName: string;
    reporterEmail: string;
    reporterRole: string;
    viewingAsClient: boolean;
    viewAsCompanyName: string | null;
    viewAsContactName: string | null;
  }
): string {
  const s = input.snapshot || ({} as DebugSnapshot);
  const trail = (s.trail || [])
    .slice(-12)
    .map((e) => `- ${e.at} · ${e.kind} · ${e.label}${e.href ? ` (${e.href})` : ""}`)
    .join("\n");
  const consoleLines = (s.console || [])
    .slice(-20)
    .map((e) => `- ${e.at} [${e.level}] ${e.message}`)
    .join("\n");
  const network = (s.networkFails || [])
    .slice(-12)
    .map((e) => `- ${e.at} ${e.method} ${e.status ?? "fail"} ${e.url}`)
    .join("\n");
  const viewport = s.viewport || { w: 0, h: 0, dpr: 1 };

  return [
    `# Debug: ${(input.title || "").trim() || "Untitled issue"}`,
    "",
    line("Severity", input.severity),
    line("Reported", s.capturedAt),
    line("Reporter", `${extras.reporterName} <${extras.reporterEmail}> · ${extras.reporterRole}`),
    extras.viewingAsClient
      ? line(
          "Viewing as client",
          [extras.viewAsCompanyName, extras.viewAsContactName].filter(Boolean).join(" · ") ||
            "yes"
        )
      : line("Mode", "staff"),
    line("Location", s.locationLabel),
    line("URL", s.href),
    line("Path", `${s.pathname || ""}${s.search || ""}${s.hash || ""}`),
    line("Tab (no URL)", s.selectedTab),
    line("Page title", s.pageTitle),
    line("Heading", s.heading),
    line("Error digest", s.digest),
    line("Viewport", `${viewport.w}×${viewport.h} @${viewport.dpr} · ${s.timezone || ""}`),
    line("UA", s.userAgent),
    "",
    block("What happened", input.whatHappened),
    block("Expected", input.expected),
    block("Actual", input.actual),
    block("How it was before", input.beforeExperience),
    block("How it is now", input.afterExperience),
    block("Repro", input.reproSteps),
    "## Navigation trail",
    "",
    trail || "_none_",
    "",
    "## Visible headings",
    "",
    codeList(s.headings || []),
    "",
    "## Console (recent errors/warnings)",
    "",
    consoleLines || "_none_",
    "",
    "## Failed network calls",
    "",
    network || "_none_",
    "",
    "## Agent notes",
    "",
    "Investigate the URL + selected tab first. Tabs without a URL are in **Tab (no URL)** and the trail. Prefer the user narrative over console noise. Mark the report resolved or hidden after the fix ships.",
    "",
  ]
    .filter((row, i, arr) => !(row === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

export function compileOpenReportsMarkdown(
  reports: Array<{
    title?: string | null;
    created_at: string;
    status: string;
    severity: string;
    reporter_name: string | null;
    location_label: string | null;
    agent_brief: string;
  }>
): string {
  if (!reports.length) return "# Debug bank\n\nNo open reports.\n";

  function reportTitle(r: (typeof reports)[number], index: number): string {
    const direct = r.title?.trim();
    if (direct) return direct;
    const fromBrief = r.agent_brief.match(/^\*\*Title:\*\*\s*(.+)$/m)?.[1]?.trim();
    if (fromBrief) return fromBrief;
    const heading = r.agent_brief.split("\n")[0]?.replace(/^#\s*/, "").trim();
    if (heading && !/^(Bug|Enhancement)\s*\(via MCP\)$/i.test(heading)) {
      return heading;
    }
    return `Report ${index + 1}`;
  }

  const toc = reports
    .map((r, i) => {
      const title = reportTitle(r, i);
      return `${i + 1}. ${title} — ${r.severity} · ${r.status} · ${r.reporter_name || "staff"} · ${r.location_label || ""}`;
    })
    .join("\n");
  return [
    "# WIDE OS debug bank",
    "",
    `Exported ${new Date().toISOString()} · ${reports.length} report(s)`,
    "",
    toc,
    "",
    reports.map((r) => r.agent_brief.trim()).join("\n\n---\n\n"),
    "",
  ].join("\n");
}

export function locationLabelFromSnapshot(s: Pick<DebugSnapshot, "pathname" | "search" | "hash" | "heading" | "selectedTab" | "pageTitle">): string {
  const parts = [s.pathname.replace(/^\/app\//, "") || s.pathname];
  if (s.search) parts.push(s.search);
  if (s.hash) parts.push(s.hash);
  if (s.selectedTab) parts.push(`tab: ${s.selectedTab}`);
  if (s.heading && s.heading !== s.pageTitle) parts.push(s.heading);
  return parts.filter(Boolean).join(" · ");
}
