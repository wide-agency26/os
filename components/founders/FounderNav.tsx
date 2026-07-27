"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { adminPaths } from "@/lib/wide-os/paths";
import { WideLogo } from "@/components/brand/WideLogo";

const FOUNDER_NAV = [
  { label: "Dashboard", href: adminPaths.dashboard(), match: "/admin/dashboard" },
  { label: "Clients", href: adminPaths.clients(), match: "/admin/clients" },
  { label: "Financials", href: adminPaths.financials(), match: "/admin/financials" },
  { label: "Brand Book", href: adminPaths.wideBook(), match: "/admin/wide-book" },
  { label: "Resources", href: adminPaths.resources(), match: "/admin/resources" },
] as const;

const IconLines = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M3 4H17M3 8H12M3 12H17M3 16H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconDiamond = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M10 2L17 10L10 18L3 10L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IconUsers = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2 17C2 14.2386 4.23858 12 7 12H8C10.7614 12 13 14.2386 13 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="14" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14 11C16.2091 11 18 12.7909 18 15V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconFolder = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M2 5C2 3.89543 2.89543 3 4 3H8L10 5H16C17.1046 5 18 5.89543 18 7V15C18 16.1046 17.1046 17 16 17H4C2.89543 17 2 16.1046 2 15V5Z" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const IconGear = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 1V3M10 17V19M19 10H17M3 10H1M16.36 3.64L14.95 5.05M5.05 14.95L3.64 16.36M16.36 16.36L14.95 14.95M5.05 5.05L3.64 3.64" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconLogout = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
    <path d="M7 17H4C3.44772 17 3 16.5523 3 16V4C3 3.44772 3.44772 3 4 3H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 14L17 10L13 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ICONS = [IconLines, IconUsers, IconDiamond, IconFolder, IconGear] as const;

function isNavActive(pathname: string, match: string, href: string) {
  if (match === "/admin/clients" || match === "/admin/resources") {
    return pathname === href || pathname.startsWith(`${match}/`);
  }
  return pathname === href || pathname.startsWith(`${match}/`);
}

export function FounderNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 lg:hidden"
        aria-label="Open navigation"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}
      <aside
        className={`founder-sidebar fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-zinc-800 bg-zinc-950 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-zinc-800 px-4 py-4">
          <Link href={adminPaths.dashboard()} className="block space-y-2">
            <WideLogo variant="onDark" height={33} priority boxed />
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
              WIDE OS
            </p>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {FOUNDER_NAV.map((item, i) => {
              const active = isNavActive(pathname, item.match, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-zinc-800 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <span className={active ? "text-[#00FF00]" : "text-zinc-600"}>{ICONS[i]}</span>
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-zinc-800 px-3 py-2">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:text-rose-400"
            >
              {IconLogout}
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
