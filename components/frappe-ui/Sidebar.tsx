"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  Briefcase,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Wrench,
  Boxes,
  X,
  Search,
  BadgeCheck,
  Presentation,
  Receipt,
  ScrollText,
  Eye,
  List,
  type LucideIcon,
} from "lucide-react";
import { workPaths } from "@/lib/work/paths";
import { createClient } from "@/utils/supabase/client";
import { performSignOut } from "@/lib/auth/sign-out";
import { isFounder } from "@/lib/rbac";
import { WideLogo } from "@/components/brand/WideLogo";
import { useMobileNav } from "@/components/frappe-ui/MobileNav";
import { HardLink } from "@/components/frappe-ui/HardLink";

type SubItem = {
  name: string;
  href: string;
  founderOnly?: boolean;
  /** Match pathname exactly (Directory at /app/crm vs /app/crm/access). */
  exact?: boolean;
  icon?: LucideIcon;
  /** Stronger row — used for Clients, the live-work shortcut. */
  emphasis?: boolean;
  match?: (pathname: string, search: string) => boolean;
  /** Nested children (e.g. Reports → Report / Sources) */
  items?: SubItem[];
};

type ModuleItem = {
  name: string;
  href: string;
  icon: any;
  items?: SubItem[];
  founderOnly?: boolean;
  clientOnly?: boolean;
  /** Greyed out, non-navigable */
  comingSoon?: boolean;
  /** Sidebar section label shown above this module when it changes */
  group?: string;
  isActive?: (pathname: string) => boolean;
};

function isWorkNavPath(pathname: string) {
  if (pathname === "/app/work" || pathname.startsWith("/app/work/")) return true;
  if (
    pathname === "/app/projects/project" ||
    pathname.startsWith("/app/projects/project/")
  ) {
    return true;
  }
  if (/^\/app\/projects\/[0-9a-f-]{36}(\/|$)/i.test(pathname)) {
    return !pathname.includes("/ci-builder");
  }
  return false;
}

function isToolsNavPath(pathname: string) {
  if (pathname.startsWith("/app/tools")) return true;
  if (pathname.includes("/ci-builder")) return true;
  if (
    pathname === "/app/projects/report" ||
    pathname.startsWith("/app/projects/report-data") ||
    pathname.startsWith("/app/projects/funnel") ||
    pathname.startsWith("/app/projects/insights")
  ) {
    return true;
  }
  if (pathname === "/app/seo" || pathname.startsWith("/app/seo/")) return true;
  if (pathname === "/app/blog-builder" || pathname.startsWith("/app/blog-builder/")) return true;
  if (pathname === "/app/tools/blog" || pathname.startsWith("/app/tools/blog/")) return true;
  if (pathname === "/app/sentiment" || pathname.startsWith("/app/sentiment/")) {
    return true;
  }
  return false;
}

const MODULES: ModuleItem[] = [
  { name: "Home", href: "/app/home", icon: Home },
  {
    name: "Accounting",
    href: "/app/accounting",
    icon: FileText,
    founderOnly: true,
    items: [
      { name: "Dashboard", href: "/app/accounting" },
      { name: "Unidentified", href: "/app/accounting/unidentified" },
      { name: "Identified", href: "/app/accounting/identified" },
      { name: "Actual", href: "/app/accounting/actual" },
      { name: "Runway", href: "/app/accounting/runway" },
      { name: "Projections", href: "/app/accounting/projections" },
    ],
  },
  {
    name: "Resources",
    href: "/app/resources",
    icon: Boxes,
    founderOnly: true,
  },
  {
    name: "CRM",
    href: "/app/crm",
    icon: Users,
    founderOnly: true,
    items: [
      { name: "Directory", href: "/app/crm", exact: true },
      { name: "Access", href: "/app/crm/access" },
    ],
  },
  {
    name: "HR",
    href: "/app/hr",
    icon: Users,
    founderOnly: true,
    items: [
      { name: "Dashboard", href: "/app/hr" },
      { name: "Roster", href: "/app/hr/roster" },
      { name: "Pipeline", href: "/app/hr/pipeline" },
      { name: "Compensation", href: "/app/hr/compensation" },
      { name: "Settings", href: "/app/hr/settings" },
    ],
  },
  {
    name: "Work",
    href: workPaths.hub,
    icon: Briefcase,
    founderOnly: true,
    group: "Work",
    isActive: isWorkNavPath,
    items: [
      {
        name: "Full Pipeline",
        href: workPaths.hub,
        match: (pathname) => pathname === "/app/work",
      },
      {
        name: "Prospecting",
        href: workPaths.prospects,
        match: (pathname) =>
          pathname === "/app/work/prospects" ||
          pathname.startsWith("/app/work/qualify"),
        items: [
          {
            name: "Find",
            href: workPaths.findTool,
            icon: Search,
            match: (pathname) =>
              pathname === "/app/work/find" || pathname.startsWith("/app/tools/find"),
          },
          {
            name: "Qualifier",
            href: workPaths.qualify,
            icon: BadgeCheck,
            match: (pathname, search) =>
              pathname.startsWith("/app/work/qualify") ||
              (pathname === "/app/work/prospects" &&
                new URLSearchParams(search).get("filter") === "qualify"),
          },
        ],
      },
      {
        name: "Lead",
        href: workPaths.leads,
        match: (pathname) => pathname === "/app/work/leads",
        items: [
          { name: "SOW builder", href: workPaths.sow, icon: FileText },
          { name: "Proposal builder", href: workPaths.propose, icon: Presentation },
          { name: "Quote builder", href: workPaths.quotes, icon: Receipt },
          { name: "Contract builder", href: workPaths.contract, icon: ScrollText },
        ],
      },
      {
        name: "Clients",
        href: workPaths.clients,
        emphasis: true,
        match: (pathname) => pathname === "/app/work/clients",
        items: [
          { name: "View as client", href: workPaths.viewAs, icon: Eye },
        ],
      },
      {
        name: "Archive",
        href: workPaths.archived,
        match: (pathname) => pathname === "/app/work/archived",
        items: [
          { name: "Closed Projects", href: workPaths.done, icon: List },
          { name: "Lost Deals", href: workPaths.lose, icon: List },
        ],
      },
    ],
  },
  {
    name: "Tools",
    href: workPaths.toolsCi,
    icon: Wrench,
    founderOnly: true,
    group: "Tools",
    isActive: isToolsNavPath,
    items: [
      { name: "Deal Finder", href: workPaths.toolsFind },
      { name: "CI Builder", href: workPaths.toolsCi },
      {
        name: "Reports",
        href: workPaths.toolsReports,
        items: [
          { name: "Report", href: workPaths.toolsReports },
          { name: "Sources", href: workPaths.toolsReportsSources },
        ],
      },
      { name: "Content", href: workPaths.toolsContent },
      { name: "Blog Builder", href: workPaths.blogBuilder },
      { name: "SEO", href: workPaths.seo },
      { name: "Sentiment", href: "/app/sentiment" },
    ],
  },
  {
    name: "Playbooks",
    href: workPaths.playbooks,
    icon: BookOpen,
    founderOnly: true,
    group: "Infra",
  },
  {
    name: "Settings",
    href: "/app/settings",
    icon: Settings,
    founderOnly: true,
    isActive: (pathname) =>
      pathname.startsWith("/app/settings") || pathname.startsWith("/app/debug-center"),
    items: [
      { name: "Connections", href: "/app/settings/connections" },
      { name: "Activity", href: "/app/settings/activity" },
      { name: "Task log", href: "/app/settings/observation" },
      { name: "Debug center", href: "/app/debug-center" },
      { name: "Inbound email", href: "/app/settings/integrations" },
      {
        name: "Cost settings",
        href: "/app/settings/pm",
      },
    ],
  },
];

function parseHref(href: string) {
  const q = href.indexOf("?");
  if (q === -1) return { path: href, params: new URLSearchParams() };
  return { path: href.slice(0, q), params: new URLSearchParams(href.slice(q + 1)) };
}

function pathMatches(
  pathname: string,
  search: string,
  href: string,
  exact?: boolean
) {
  const { path, params } = parseHref(href);
  const pathOk = exact
    ? pathname === path
    : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathOk) return false;
  const needed = [...params.entries()];
  if (needed.length === 0) return true;
  if (pathname !== path) return false;
  const current = new URLSearchParams(search);
  return needed.every(([key, value]) => current.get(key) === value);
}

function subItemActive(pathname: string, search: string, item: SubItem): boolean {
  if (item.match) return item.match(pathname, search);
  return pathMatches(pathname, search, item.href, item.exact);
}

function itemOrChildrenActive(pathname: string, search: string, item: SubItem): boolean {
  if (subItemActive(pathname, search, item)) return true;
  return Boolean(
    item.items?.some((child) => itemOrChildrenActive(pathname, search, child))
  );
}

export function Sidebar({
  initialRole = null,
  initialDisplayName = "Admin User",
}: {
  initialRole?: string | null;
  initialDisplayName?: string;
} = {}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const { open, setOpen } = useMobileNav();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(initialRole);
  const [displayName, setDisplayName] = useState(initialDisplayName);

  useEffect(() => {
    setSearch(typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "");
  }, [pathname]);

  useEffect(() => {
    if (initialRole) {
      setUserRole(initialRole);
      setDisplayName(initialDisplayName);
      return;
    }
    async function fetchRole() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .single();
          if (profile) {
            setUserRole(profile.role);
            if (profile.full_name) setDisplayName(profile.full_name);
          }
        }
      } catch {
        /* ignore */
      }
    }
    void fetchRole();
  }, [initialRole, initialDisplayName]);

  const isFounderRole = isFounder(userRole);

  // Auto-expand active module + nested groups (e.g. Reports when on Data Hub)
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      MODULES.forEach((mod) => {
        if (!mod.items) return;
        const underModule =
          (mod.isActive
            ? mod.isActive(pathname)
            : pathMatches(pathname, search, mod.href)) ||
          mod.items.some((item) => itemOrChildrenActive(pathname, search, item));
        if (underModule && next[mod.name] === undefined) {
          next[mod.name] = true;
        }
      });
      return next;
    });
  }, [pathname, search]);

  const toggleExpand = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const renderSubItems = (items: SubItem[], depth = 0) => (
    <div
      className={`mt-1 space-y-0.5 border-l border-border ${
        depth === 0 ? "ml-4 pl-3" : "ml-2 pl-2"
      }`}
    >
      {items
        .filter((sub) => !sub.founderOnly || isFounderRole)
        .map((sub) => {
          const hasChildren = Boolean(sub.items?.length);
          const isSubActive = subItemActive(pathname, search, sub);
          const childActive = hasChildren && itemOrChildrenActive(pathname, search, sub);
          const nestedChildActive =
            hasChildren &&
            Boolean(sub.items?.some((child) => itemOrChildrenActive(pathname, search, child)));
          const isGroupOpen = expanded[sub.name] ?? nestedChildActive;
          const Icon = sub.icon;

          return (
            <div key={sub.href + sub.name} className="flex flex-col">
              <div className="flex items-center gap-0.5">
                <HardLink
                  href={sub.href}
                  className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                    sub.emphasis
                      ? isSubActive
                        ? "bg-accent text-white font-semibold"
                        : childActive
                          ? "bg-accent/10 text-text-primary font-semibold"
                          : "bg-accent/10 text-text-primary font-semibold hover:bg-accent/15"
                      : isSubActive
                        ? "bg-sidebar-active text-text-primary font-medium"
                        : childActive
                          ? "text-text-primary font-medium"
                          : "text-text-muted hover:bg-sidebar-hover hover:text-text-primary"
                  }`}
                >
                  {Icon ? (
                    <Icon
                      size={13}
                      strokeWidth={1.75}
                      className={`shrink-0 ${
                        sub.emphasis && isSubActive ? "text-white" : ""
                      }`}
                    />
                  ) : null}
                  {sub.name}
                </HardLink>
                {hasChildren && (
                  <button
                    type="button"
                    aria-label={isGroupOpen ? `Collapse ${sub.name}` : `Expand ${sub.name}`}
                    onClick={(e) => toggleExpand(sub.name, e)}
                    className={`p-1 rounded shrink-0 ${
                      sub.emphasis
                        ? "text-text-secondary hover:bg-accent/15 hover:text-text-primary"
                        : "text-text-muted hover:bg-sidebar-hover hover:text-text-primary"
                    }`}
                  >
                    {isGroupOpen ? (
                      <ChevronDown size={12} strokeWidth={1.75} />
                    ) : (
                      <ChevronRight size={12} strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </div>
              {hasChildren && isGroupOpen && sub.items && renderSubItems(sub.items, depth + 1)}
            </div>
          );
        })}
    </div>
  );

  return (
    <aside
      data-os-sidebar
      className={`fixed inset-y-0 left-0 z-[60] w-[min(20rem,88vw)] flex-shrink-0 flex flex-col bg-sidebar border-r border-border h-[100dvh] text-[13px] transition-transform duration-200 md:static md:z-auto md:w-[240px] md:h-full md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "var(--os-bottom-nav)",
      }}
    >
      <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0">
        <HardLink href="/app/home" className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center rounded-md bg-accent px-2 py-1 shrink-0">
            <WideLogo variant="onDark" boxed={false} height={14} />
          </span>
          <span className="font-semibold text-text-primary tracking-wide text-[13px]">
            OS
          </span>
        </HardLink>
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-text-muted hover:bg-sidebar-hover"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {MODULES.filter((mod) => {
          if (mod.founderOnly && !isFounderRole) return false;
          if (mod.clientOnly && isFounderRole) return false;
          return true;
        }).map((mod, index, visible) => {
          const isActive =
            !mod.comingSoon &&
            (mod.isActive
              ? mod.isActive(pathname)
              : pathname === mod.href ||
                (mod.href !== "/app/home" && pathMatches(pathname, search, mod.href)) ||
                Boolean(
                  mod.items?.some((item) => itemOrChildrenActive(pathname, search, item))
                ));
          const isExpanded = expanded[mod.name];
          const Icon = mod.icon;
          const prevGroup = index > 0 ? visible[index - 1].group : undefined;
          const showGroup = Boolean(mod.group && mod.group !== prevGroup);

          if (mod.comingSoon) {
            return (
              <div key={mod.name}>
                {showGroup && (
                  <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3 px-3 mt-5">
                    {mod.group}
                  </div>
                )}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-md text-text-muted cursor-not-allowed select-none opacity-70"
                  title="Coming soon"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} strokeWidth={1.75} className="text-text-muted" />
                    <span>{mod.name}</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-sidebar-active text-text-muted px-1.5 py-0.5 rounded-md">
                    Soon
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={mod.name} className="flex flex-col">
              {showGroup && (
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3 px-3 mt-5">
                  {mod.group}
                </div>
              )}
              {!mod.group && index === 0 && (
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3 px-3 mt-2">
                  Modules
                </div>
              )}
              <HardLink
                href={mod.href}
                className={`group flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-sidebar-active text-text-primary font-medium"
                    : "text-text-secondary hover:bg-sidebar-hover hover:text-text-primary"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={16}
                    strokeWidth={1.75}
                    className={isActive ? "text-text-primary" : "text-text-muted group-hover:text-text-secondary"}
                  />
                  {mod.name}
                </div>
                {mod.items && (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(mod.name, e)}
                    className={`p-0.5 rounded transition-colors ${
                      isActive ? "hover:bg-border text-text-secondary" : "hover:bg-sidebar-active text-text-muted"
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} strokeWidth={1.75} />
                    ) : (
                      <ChevronRight size={14} strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </HardLink>

              {mod.items && isExpanded && renderSubItems(mod.items)}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-border shrink-0 space-y-1">
        <button
          type="button"
          onClick={() => void performSignOut()}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-50 rounded-md cursor-pointer transition-colors group text-left"
          title="Sign out"
        >
          <div className="w-8 h-8 rounded-md bg-accent text-white flex items-center justify-center font-medium text-xs shrink-0">
            {(displayName || "A").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-text-primary truncate">{displayName}</p>
            <p className="text-[11px] text-text-muted truncate">
              {userRole === "superadmin" || userRole === "admin" ? "Superadmin" : "Staff"}
            </p>
          </div>
          <LogOut
            size={14}
            strokeWidth={1.75}
            className="text-text-muted group-hover:text-danger transition-colors shrink-0"
          />
        </button>
      </div>
    </aside>
  );
}
