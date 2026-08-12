"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BarChart3,
  FileText,
  Folder,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { performSignOut } from "@/lib/auth/sign-out";

const CLIENT_NAV = [
  { name: "Brand Guidelines", href: "/app/client-guidelines", icon: BookOpen },
  { name: "Reports", href: "/app/client-reports", icon: BarChart3 },
  { name: "Scope of Work", href: "/app/client-sow", icon: FileText },
  { name: "Files", href: "/app/client-files", icon: Folder, badge: "Soon" },
];

function isGuidelineDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-guidelines/") &&
    pathname !== "/app/client-guidelines"
  );
}

function isSowDetail(pathname: string) {
  return (
    pathname.startsWith("/app/client-sow/") && pathname !== "/app/client-sow"
  );
}

export function ClientSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Auto-minimize on guideline detail so section nav + main nav can coexist
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
      className={`flex-shrink-0 flex flex-col bg-[#F9FAFB] border-r border-[#E5E7EB] h-screen text-[13px] transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-[240px]"
      }`}
    >
      <div
        className={`border-b border-[#E5E7EB] shrink-0 ${
          collapsed
            ? "flex flex-col items-center gap-1 px-1 py-2"
            : "h-14 flex items-center justify-between px-3 gap-2"
        }`}
      >
        <Link
          href="/app/client-guidelines"
          className="flex items-center gap-2 group min-w-0"
          title="WIDE Client Portal"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
            W
          </div>
          {!collapsed && (
            <span className="font-semibold text-gray-900 tracking-wide truncate group-hover:text-black transition-colors">
              Client Portal
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0"
          title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {!collapsed && (
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
            Workspace
          </div>
        )}
        {CLIENT_NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/app/client-guidelines" &&
              pathname.startsWith("/app/client-guidelines")) ||
            (item.href === "/app/client-sow" &&
              pathname.startsWith("/app/client-sow"));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`flex items-center rounded-lg transition-colors ${
                collapsed ? "justify-center px-2 py-2.5" : "justify-between px-3 py-2.5"
              } ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium"
              }`}
            >
              <div className={`flex items-center ${collapsed ? "" : "gap-3"}`}>
                <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                {!collapsed && <span>{item.name}</span>}
              </div>
              {!collapsed && item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-200/70 text-gray-600 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-2 border-t border-[#E5E7EB] shrink-0">
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className={`w-full flex items-center rounded-lg transition-colors group text-gray-600 hover:bg-red-50 hover:text-red-600 ${
            collapsed ? "justify-center px-2 py-2" : "justify-between px-3 py-2"
          }`}
        >
          {!collapsed && <span className="font-medium text-xs">Sign Out</span>}
          <LogOut
            size={14}
            className="text-gray-400 group-hover:text-red-600 transition-colors"
          />
        </button>
      </div>
    </aside>
  );
}
