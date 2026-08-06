"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Home,
  Briefcase,
  Users,
  FileText,
  Settings,
  LogOut,
  Command,
  ChevronDown,
  ChevronRight,
  Building2,
  BookOpen,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { performSignOut } from "@/lib/auth/sign-out";
import { isFounder } from "@/lib/rbac";

type SubItem = {
  name: string;
  href: string;
  founderOnly?: boolean;
  /** Nested children (e.g. Reports → Data Hub / Funnel / Insights) */
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
};

const MODULES: ModuleItem[] = [
  { name: "Home", href: "/app/home", icon: Home },
  {
    name: "Company Overview",
    href: "/app/company-overview",
    icon: Building2,
    founderOnly: true,
  },
  {
    name: "Accounting",
    href: "/app/accounting",
    icon: FileText,
    founderOnly: true,
    items: [
      { name: "Dashboard", href: "/app/accounting" },
      { name: "Sales Invoices", href: "/app/accounting/sales-invoice" },
      { name: "Expenses", href: "/app/accounting/expense" },
    ],
  },
  {
    name: "CRM",
    href: "/app/crm",
    icon: Users,
    founderOnly: true,
    items: [
      { name: "Customers", href: "/app/crm" },
      { name: "New Customer", href: "/app/crm/new" },
      { name: "Access Requests", href: "/app/client-access" },
      { name: "Company Users", href: "/app/crm/users" },
    ],
  },
  {
    name: "HR",
    href: "/app/hr",
    icon: Users,
    founderOnly: true,
    comingSoon: true,
  },
  {
    name: "Clients",
    href: "/app/projects",
    icon: Briefcase,
    founderOnly: true,
    items: [
      { name: "Projects", href: "/app/projects/project" },
      {
        name: "Report builder",
        href: "/app/projects/report",
        items: [
          { name: "Data Hub", href: "/app/projects/report-data" },
          { name: "Funnel Config", href: "/app/projects/funnel" },
          { name: "AI Insights", href: "/app/projects/insights" },
        ],
      },
      { name: "CI Builder", href: "/app/projects/ci-builder" },
    ],
  },
  {
    name: "Playbooks",
    href: "/app/playbooks",
    icon: BookOpen,
    founderOnly: true,
  },
  {
    name: "Settings",
    href: "/app/settings",
    icon: Settings,
    founderOnly: true,
    items: [
      { name: "Roles & Rates", href: "/app/settings/roles-rates" },
      { name: "Integrations", href: "/app/settings/integrations" },
      {
        name: "Cost settings",
        href: "/app/settings/pm",
      },
    ],
  },
];

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemOrChildrenActive(pathname: string, item: SubItem): boolean {
  if (pathMatches(pathname, item.href)) return true;
  return Boolean(item.items?.some((child) => itemOrChildrenActive(pathname, child)));
}

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Admin User");

  useEffect(() => {
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
  }, []);

  const isFounderRole = isFounder(userRole);

  // Auto-expand active module + nested groups (e.g. Reports when on Data Hub)
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      MODULES.forEach((mod) => {
        if (!mod.items) return;
        const underModule =
          pathMatches(pathname, mod.href) ||
          mod.items.some((item) => itemOrChildrenActive(pathname, item));
        if (underModule && next[mod.name] === undefined) {
          next[mod.name] = true;
        }
        mod.items.forEach((item) => {
          if (!item.items?.length) return;
          if (itemOrChildrenActive(pathname, item) && next[item.name] === undefined) {
            next[item.name] = true;
          }
        });
      });
      return next;
    });
  }, [pathname]);

  const toggleExpand = (name: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const renderSubItems = (items: SubItem[], depth = 0) => (
    <div
      className={`mt-1 space-y-0.5 border-l border-gray-200 ${
        depth === 0 ? "ml-4 pl-3" : "ml-2 pl-2"
      }`}
    >
      {items
        .filter((sub) => !sub.founderOnly || isFounderRole)
        .map((sub) => {
          const hasChildren = Boolean(sub.items?.length);
          const isSubActive = pathMatches(pathname, sub.href);
          const childActive = hasChildren && itemOrChildrenActive(pathname, sub);
          const isGroupOpen = expanded[sub.name] ?? childActive;

          return (
            <div key={sub.href + sub.name} className="flex flex-col">
              <div className="flex items-center gap-0.5">
                <Link
                  href={sub.href}
                  onClick={() => {
                    if (hasChildren) {
                      setExpanded((prev) => ({ ...prev, [sub.name]: true }));
                    }
                  }}
                  className={`flex-1 block px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                    isSubActive || (hasChildren && childActive && isSubActive)
                      ? "bg-gray-200/50 text-gray-900 font-medium"
                      : childActive
                        ? "text-gray-800 font-medium"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {sub.name}
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    aria-label={isGroupOpen ? `Collapse ${sub.name}` : `Expand ${sub.name}`}
                    onClick={(e) => toggleExpand(sub.name, e)}
                    className="p-1 rounded text-gray-400 hover:bg-gray-200 hover:text-gray-700 shrink-0"
                  >
                    {isGroupOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
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
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-[#F9FAFB] border-r border-[#E5E7EB] h-screen text-[13px]">
      <div className="h-14 flex items-center px-4 border-b border-[#E5E7EB] shrink-0">
        <Link href="/app/home" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">
            W
          </div>
          <span className="font-semibold text-gray-900 tracking-wide group-hover:text-black transition-colors">
            WIDE OS
          </span>
        </Link>
      </div>

      <div className="p-3">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search size={14} />
            <span>Search...</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 font-medium font-sans">
            <Command size={10} />
            <span>K</span>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3 mt-2">
          Modules
        </div>
        {MODULES.filter((mod) => {
          if (mod.founderOnly && !isFounderRole) return false;
          if (mod.clientOnly && isFounderRole) return false;
          return true;
        }).map((mod) => {
          const isActive =
            !mod.comingSoon &&
            (pathname === mod.href ||
              (mod.href !== "/app/home" && pathMatches(pathname, mod.href)) ||
              Boolean(mod.items?.some((item) => itemOrChildrenActive(pathname, item))));
          const isExpanded = expanded[mod.name];
          const Icon = mod.icon;

          if (mod.comingSoon) {
            return (
              <div
                key={mod.name}
                className="flex items-center justify-between px-3 py-2 rounded-md text-gray-400 cursor-not-allowed select-none opacity-70"
                title="Coming soon"
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} className="text-gray-300" />
                  <span>{mod.name}</span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-200/80 text-gray-500 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <div key={mod.name} className="flex flex-col">
              <Link
                href={mod.href}
                className={`group flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-gray-200/60 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={16}
                    className={isActive ? "text-gray-800" : "text-gray-400 group-hover:text-gray-600"}
                  />
                  {mod.name}
                </div>
                {mod.items && (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(mod.name, e)}
                    className={`p-0.5 rounded transition-colors ${
                      isActive ? "hover:bg-gray-300 text-gray-600" : "hover:bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
              </Link>

              {mod.items && isExpanded && renderSubItems(mod.items)}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-[#E5E7EB] shrink-0 space-y-1">
        <button
          type="button"
          onClick={() => void performSignOut()}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-red-50 rounded-md cursor-pointer transition-colors group text-left"
          title="Sign out"
        >
          <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center font-medium shadow-inner text-xs shrink-0">
            {(displayName || "A").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-[11px] text-gray-500 truncate">
              {userRole === "superadmin" || userRole === "admin" ? "Superadmin" : "Staff"}
            </p>
          </div>
          <LogOut
            size={14}
            className="text-gray-400 group-hover:text-red-600 transition-all shrink-0"
          />
        </button>
      </div>
    </aside>
  );
}
