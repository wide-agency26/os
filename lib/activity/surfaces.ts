export type ActorRole = "staff" | "client" | "prospect" | "view_as";

export type ActivitySurface =
  | "progress"
  | "guidelines"
  | "reports"
  | "seo"
  | "content"
  | "blog"
  | "tasks"
  | "sow"
  | "files"
  | "access"
  | "pm"
  | "review"
  | "bd"
  | "ledger"
  | "hr"
  | "home"
  | "other";

export type ActivityEventType =
  | "page_view"
  | "resource_open"
  | "file_download"
  | "file_opened"
  | "portal_visit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isClientFacingPath(pathname: string): boolean {
  return (
    pathname === "/app/client-progress" ||
    pathname.startsWith("/app/client-progress/") ||
    pathname === "/app/client-guidelines" ||
    pathname.startsWith("/app/client-guidelines/") ||
    pathname === "/app/client-reports" ||
    pathname.startsWith("/app/client-reports/") ||
    pathname === "/app/client-seo" ||
    pathname.startsWith("/app/client-seo/") ||
    pathname === "/app/client-content" ||
    pathname.startsWith("/app/client-content/") ||
    pathname === "/app/client-blog" ||
    pathname.startsWith("/app/client-blog/") ||
    pathname === "/app/client-tasks" ||
    pathname.startsWith("/app/client-tasks/") ||
    pathname === "/app/client-sow" ||
    pathname.startsWith("/app/client-sow/") ||
    pathname === "/app/client-files" ||
    pathname.startsWith("/app/client-files/") ||
    pathname === "/app/client-access" ||
    pathname.startsWith("/app/client-access/")
  );
}

function firstSegmentAfter(pathname: string, prefix: string): string | null {
  if (pathname === prefix) return null;
  if (!pathname.startsWith(prefix + "/")) return null;
  const rest = pathname.slice(prefix.length + 1).split("/")[0];
  return rest && rest.length > 0 && rest !== "print" ? rest : null;
}

export function describePath(pathname: string): {
  surface: ActivitySurface;
  eventType: "page_view" | "resource_open";
  resourceId: string | null;
  projectId: string | null;
} {
  const path = pathname.split("?")[0] || pathname;

  const clientTabs: Array<[string, ActivitySurface]> = [
    ["/app/client-progress", "progress"],
    ["/app/client-guidelines", "guidelines"],
    ["/app/client-reports", "reports"],
    ["/app/client-seo", "seo"],
    ["/app/client-content", "content"],
    ["/app/client-blog", "blog"],
    ["/app/client-tasks", "tasks"],
    ["/app/client-sow", "sow"],
    ["/app/client-files", "files"],
    ["/app/client-access", "access"],
  ];
  for (const [prefix, surface] of clientTabs) {
    if (path === prefix || path.startsWith(prefix + "/")) {
      const resourceId = firstSegmentAfter(path, prefix);
      return {
        surface,
        eventType: resourceId ? "resource_open" : "page_view",
        resourceId,
        projectId: null,
      };
    }
  }

  const projectMatch = path.match(/^\/app\/projects\/([0-9a-f-]{36})(\/|$)/i);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const rest = path.slice(`/app/projects/${projectId}`.length);
    const surface: ActivitySurface = rest.startsWith("/review")
      ? "review"
      : rest.startsWith("/tasks")
        ? "pm"
        : "pm";
    return { surface, eventType: "page_view", resourceId: null, projectId };
  }

  if (path.startsWith("/app/projects") || path.startsWith("/app/playbooks")) {
    return { surface: "pm", eventType: "page_view", resourceId: null, projectId: null };
  }
  if (path.startsWith("/app/bd") || path.startsWith("/app/work") || path.startsWith("/app/crm")) {
    return { surface: "bd", eventType: "page_view", resourceId: null, projectId: null };
  }
  if (path.startsWith("/app/accounting")) {
    return { surface: "ledger", eventType: "page_view", resourceId: null, projectId: null };
  }
  if (path.startsWith("/app/hr") || path.startsWith("/app/resources")) {
    return { surface: "hr", eventType: "page_view", resourceId: null, projectId: null };
  }
  if (path === "/app/home" || path === "/app") {
    return { surface: "home", eventType: "page_view", resourceId: null, projectId: null };
  }

  return { surface: "other", eventType: "page_view", resourceId: null, projectId: null };
}

export function activityTitle(
  eventType: ActivityEventType,
  surface: ActivitySurface
): string {
  if (eventType === "file_download") return "Downloaded file";
  if (eventType === "file_opened") return "Opened file";
  if (eventType === "portal_visit") return "Opened the portal";
  if (eventType === "resource_open") return `Opened ${surface} item`;
  return `Opened ${surface}`;
}

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}
