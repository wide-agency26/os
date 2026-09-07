"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  CheckSquare,
  FileText,
  Home,
  LineChart,
  Menu,
  Newspaper,
  Users,
  Wrench,
} from "lucide-react";
import { workPaths } from "@/lib/work/paths";
import { HardLink } from "@/components/frappe-ui/HardLink";

type MobileNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  return (
    <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
  );
}

function isWorkPath(pathname: string) {
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

function isToolsPath(pathname: string) {
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
  if (pathname === "/app/blog-builder" || pathname.startsWith("/app/blog-builder/")) {
    return true;
  }
  if (pathname === "/app/tools/blog" || pathname.startsWith("/app/tools/blog/")) {
    return true;
  }
  if (pathname === "/app/sentiment" || pathname.startsWith("/app/sentiment/")) {
    return true;
  }
  return false;
}

const STAFF_TABS = [
  { href: "/app/home", label: "Home", icon: Home, match: (p: string) => p.startsWith("/app/home") },
  { href: workPaths.hub, label: "Work", icon: Briefcase, match: isWorkPath },
  { href: "/app/crm", label: "CRM", icon: Users, match: (p: string) => p.startsWith("/app/crm") },
  { href: workPaths.toolsCi, label: "Tools", icon: Wrench, match: isToolsPath },
] as const;

const CLIENT_TABS = [
  {
    href: "/app/client-progress",
    label: "Progress",
    icon: LineChart,
    match: (p: string) => p.startsWith("/app/client-progress"),
  },
  {
    href: "/app/client-reports",
    label: "Reports",
    icon: FileText,
    match: (p: string) => p.startsWith("/app/client-reports"),
  },
  {
    href: "/app/client-content",
    label: "Content",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/app/client-content"),
  },
  {
    href: "/app/client-blog",
    label: "Blog",
    icon: Newspaper,
    match: (p: string) => p.startsWith("/app/client-blog"),
  },
  {
    href: "/app/client-tasks",
    label: "Tasks",
    icon: CheckSquare,
    match: (p: string) => p.startsWith("/app/client-tasks"),
  },
] as const;

export function MobileBottomNav({
  variant,
}: {
  variant: "staff" | "client";
}) {
  const pathname = usePathname();
  const { open, toggle } = useMobileNav();
  const tabs = variant === "staff" ? STAFF_TABS : CLIENT_TABS;

  return (
    <nav
      className="os-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-[70] border-t border-border bg-surface/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 h-14">
        {tabs.map((tab) => {
          const active = !open && tab.match(pathname);
          const Icon = tab.icon;
          return (
            <HardLink
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? "text-text-primary" : "text-text-muted"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2 : 1.75} />
              {tab.label}
            </HardLink>
          );
        })}
        <button
          type="button"
          onClick={toggle}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            open ? "text-text-primary" : "text-text-muted"
          }`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <Menu size={18} strokeWidth={open ? 2 : 1.75} />
          Menu
        </button>
      </div>
    </nav>
  );
}

export function MobileNavBackdrop() {
  const { open, setOpen } = useMobileNav();
  if (!open) return null;
  return (
    <button
      type="button"
      aria-label="Close navigation"
      className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
    />
  );
}
