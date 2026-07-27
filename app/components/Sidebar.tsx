"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { signOut } from "@/app/actions/auth";
import {
  clientPaths,
  adminPaths,
} from "@/lib/wide-os/paths";
import type { WideZone } from "@/lib/wide-os/types";
import type { SidebarPortalRole } from "@/lib/routing";
import { WideLogo } from "@/components/brand/WideLogo";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const IconGrid = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconDiamond = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2L17 10L10 18L3 10L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IconChart = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 17V10M8 17V6M13 17V3M18 17V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconLines = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 4H17M3 8H12M3 12H17M3 16H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconFolder = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 5C2 3.89543 2.89543 3 4 3H8L10 5H16C17.1046 5 18 5.89543 18 7V15C18 16.1046 17.1046 17 16 17H4C2.89543 17 2 16.1046 2 15V5Z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconUsers = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 17C2 14.2386 4.23858 12 7 12H8C10.7614 12 13 14.2386 13 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="14" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14 11C16.2091 11 18 12.7909 18 15V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconGear = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 1V3M10 17V19M19 10H17M3 10H1M16.36 3.64L14.95 5.05M5.05 14.95L3.64 16.36M16.36 16.36L14.95 14.95M5.05 5.05L3.64 3.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconLogout = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 17H4C3.44772 17 3 16.5523 3 16V4C3 3.44772 3.44772 3 4 3H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 14L17 10L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

function clientNav(clientId: string): NavItem[] {
  const p = (href: string, label: string, icon: React.ReactNode) => ({ href, label, icon });
  return [
    p(clientPaths.dashboard(clientId), "Dashboard", IconGrid),
    p(clientPaths.services(clientId), "Services", IconDiamond),
    p(clientPaths.analytics(clientId), "Analytics", IconChart),
    p(clientPaths.brandbook(clientId), "Brandbook", IconLines),
    p(clientPaths.library(clientId), "Library", IconFolder),
    p(clientPaths.settings(clientId), "Settings", IconGear),
  ];
}

function cmClientNav(clientId: string, executive: boolean): NavItem[] {
  return [];
}

interface SidebarProps {
  portalRole: SidebarPortalRole;
  wideZone?: WideZone;
  clientId?: string;
  userName?: string;
  userEmail?: string;
  isSuperadmin?: boolean;
}

export default function Sidebar({
  portalRole,
  wideZone,
  clientId,
  userName = "Agency User",
  userEmail = "user@agency.com",
  isSuperadmin = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathnameZone: WideZone | null = pathname.startsWith("/admin/finance")
    ? "finance"
    : pathname.startsWith("/admin/dashboard") ||
        pathname.startsWith("/admin/process") ||
        pathname.startsWith("/admin/people") ||
        pathname.startsWith("/admin/ai-hq")
      ? "executive"
      : null;

  const effectiveZone = pathnameZone ?? wideZone;

  const { navItems, portalLabel, homeHref } = useMemo(() => {
    if (portalRole === "superadmin") {
      if (effectiveZone === "client" && clientId) {
        return {
          navItems: clientNav(clientId),
          portalLabel: "CLIENT VIEW",
          homeHref: clientPaths.dashboard(clientId),
        };
      }
      return {
        navItems: [
          { label: "Dashboard", href: adminPaths.dashboard(), icon: IconGrid },
          { label: "Clients", href: adminPaths.clients(), icon: IconUsers },
          { label: "Services", href: adminPaths.services(), icon: IconDiamond },
          { label: "Financials", href: adminPaths.financials(), icon: IconFolder },
          { label: "Brand Book Builder", href: adminPaths.wideBook(), icon: IconLines },
          { label: "Resources", href: adminPaths.resources(), icon: IconGear },
        ],
        portalLabel: "WIDE OS",
        homeHref: adminPaths.dashboard(),
      };
    }
    return {
      navItems: clientId ? clientNav(clientId) : [],
      portalLabel: "CLIENT PORTAL",
      homeHref: clientId ? clientPaths.dashboard(clientId) : "/login",
    };
  }, [effectiveZone, clientId, portalRole, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) => {
    if (href === homeHref) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-text-secondary"
        aria-label="Open sidebar"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-border-subtle sidebar-transition lg:translate-x-0 lg:static ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-4 border-b border-border-subtle">
            <Link href={homeHref} className="block space-y-2">
              <WideLogo variant="onDark" height={33} priority boxed />
              <p className="text-[10px] tracking-[0.15em] text-text-muted uppercase truncate">
                {portalLabel}
              </p>
            </Link>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {isSuperadmin && clientId && effectiveZone === "client" ? (
              <div className="mx-3 mb-3 rounded-lg border border-zinc-800 px-3 py-2 text-[10px] text-zinc-500">
                <Link href={adminPaths.dashboard()} className="font-medium text-[#00FF00] hover:underline">
                  ← Back to Dashboard
                </Link>
              </div>
            ) : null}
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(item.href) ? "bg-sidebar-active text-text-primary" : "text-text-secondary hover:bg-sidebar-hover"}`}
              >
                <span className={isActive(item.href) ? "text-accent" : "text-text-muted"}>{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="px-3 py-2">
            <form action={signOut}>
              <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-muted hover:text-danger">
                {IconLogout} Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

function motion({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
