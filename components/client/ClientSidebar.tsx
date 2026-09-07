"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BarChart3,
  CalendarDays,
  CheckSquare,
  FileText,
  Folder,
  Gauge,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  LineChart,
  X,
} from "lucide-react";
import { performSignOut } from "@/lib/auth/sign-out";
import { WideLogo } from "@/components/brand/WideLogo";
import { useMobileNav } from "@/components/frappe-ui/MobileNav";
import { HardLink } from "@/components/frappe-ui/HardLink";
import type { ClientNavKey, ClientNavState } from "@/lib/client/nav";

const CLIENT_NAV: {
  key: ClientNavKey;
  name: string;
  href: string;
  icon: typeof BookOpen;
  badge?: string;
}[] = [
  { key: "progress", name: "Progress", href: "/app/client-progress", icon: LineChart },
  { key: "guidelines", name: "Brand Guidelines", href: "/app/client-guidelines", icon: BookOpen },
  { key: "reports", name: "Reports", href: "/app/client-reports", icon: BarChart3 },
  { key: "seo", name: "SEO Audit", href: "/app/client-seo", icon: Gauge },
  { key: "content", name: "Content", href: "/app/client-content", icon: CalendarDays },
  { key: "blog", name: "Blog", href: "/app/client-blog", icon: Newspaper },
  { key: "tasks", name: "Tasks", href: "/app/client-tasks", icon: CheckSquare },
  { key: "sow", name: "Scope of Work", href: "/app/client-sow", icon: FileText },
  { key: "files", name: "Files", href: "/app/client-files", icon: Folder, badge: "Soon" },
];

function isGuidelineDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-guidelines/") &&
    pathname !== "/app/client-guidelines" &&
    !pathname.startsWith("/app/client-guidelines/preview/")
  );
}

function isSowDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-sow/") && pathname !== "/app/client-sow"
  );
}

export function ClientSidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(false);
  const [availability, setAvailability] = useState<ClientNavState | null>(null);

  useEffect(() => {
    void fetch("/api/client/nav-availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ClientNavState) => setAvailability(data))
      .catch(() => setAvailability(null));
  }, []);

  useEffect(() => {
    if (isGuidelineDetail(pathname) || isSowDetail(pathname)) {
      setCollapsed(true);
      return;
    }
    try {
      const saved = localStorage.getItem("wide-client-sidebar-collapsed");
      if (saved != null) setCollapsed(saved === "1");
    } catch {
      /* ignore */
    }
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("wide-client-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleSignOut = () => {
    void performSignOut();
  };

  return (
    <aside
      data-os-sidebar
      className={`fixed inset-y-0 left-0 z-[60] w-[min(20rem,88vw)] flex-shrink-0 flex flex-col bg-sidebar border-r border-border h-[100dvh] text-[13px] transition-[transform,width] duration-200 md:static md:z-auto md:h-full md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      } ${collapsed ? "md:w-[72px]" : "md:w-[240px]"}`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "var(--os-bottom-nav)",
      }}
    >
      <div
        className={`border-b border-border shrink-0 ${
          collapsed
            ? "flex flex-col items-center gap-1 px-1 py-2"
            : "h-14 flex items-center justify-between px-3 gap-2"
        }`}
      >
        <HardLink
          href="/app/client-guidelines"
          className="flex items-center gap-2 min-w-0"
          title="WIDE Client Portal"
        >
          <span className="inline-flex items-center rounded-md bg-accent px-1.5 py-1 shrink-0">
            <WideLogo variant="onDark" boxed={false} height={collapsed ? 12 : 14} />
          </span>
          {!collapsed ? (
            <span className="font-semibold text-text-primary tracking-wide truncate text-[13px]">
              Client
            </span>
          ) : (
            <span className="md:hidden font-semibold text-text-primary tracking-wide truncate text-[13px]">
              Client
            </span>
          )}
        </HardLink>
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-text-muted hover:bg-sidebar-hover"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:inline-flex p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-sidebar-hover shrink-0"
          title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={16} strokeWidth={1.75} />
          ) : (
            <ChevronLeft size={16} strokeWidth={1.75} />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        <div className={`text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3 px-2 ${collapsed ? "md:hidden" : ""}`}>
          Workspace
        </div>
        {CLIENT_NAV.map((item) => {
          const enabled = availability ? availability.enabled[item.key] : true;
          if (availability && !enabled) return null;
          const isActive =
            pathname === item.href ||
            (item.href !== "/app/client-guidelines" &&
              pathname.startsWith(`${item.href}/`)) ||
            (item.href === "/app/client-guidelines" &&
              pathname.startsWith("/app/client-guidelines"));
          const Icon = item.icon;
          const ready =
            item.key === "files"
              ? false
              : availability
                ? availability.ready[item.key]
                : true;
          const muted = !ready;

          return (
            <HardLink
              key={item.name}
              href={item.href}
              title={
                muted
                  ? `${item.name} — nothing published yet`
                  : item.name
              }
              className={`flex items-center rounded-md transition-colors justify-between px-3 py-2.5 ${
                collapsed ? "md:justify-center md:px-2" : ""
              } ${
                muted
                  ? "text-text-muted/55 hover:bg-transparent hover:text-text-muted/55 font-medium"
                  : isActive
                    ? "bg-sidebar-active text-text-primary font-semibold"
                    : "text-text-secondary hover:bg-sidebar-hover hover:text-text-primary font-medium"
              }`}
            >
              <div className={`flex items-center gap-3 ${collapsed ? "md:gap-0" : ""}`}>
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className={
                    muted
                      ? "text-text-muted/50"
                      : isActive
                        ? "text-text-primary"
                        : "text-text-muted"
                  }
                />
                <span className={collapsed ? "md:hidden" : ""}>{item.name}</span>
              </div>
              {(item.badge || (muted && item.key === "files")) && (
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                    collapsed ? "md:hidden" : ""
                  } ${
                    muted
                      ? "bg-transparent text-text-muted/50"
                      : "bg-sidebar-active text-text-muted"
                  }`}
                >
                  {item.badge || "Soon"}
                </span>
              )}
            </HardLink>
          );
        })}
      </div>

      <div className="p-2 border-t border-border shrink-0">
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className={`w-full flex items-center rounded-md transition-colors group text-text-secondary hover:bg-red-50 hover:text-danger justify-between px-3 py-2 ${
            collapsed ? "md:justify-center md:px-2" : ""
          }`}
        >
          <span className={`font-medium text-xs ${collapsed ? "md:hidden" : ""}`}>Sign Out</span>
          <LogOut
            size={14}
            strokeWidth={1.75}
            className="text-text-muted group-hover:text-danger transition-colors"
          />
        </button>
      </div>
    </aside>
  );
}
