"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HardLink } from "@/components/frappe-ui/HardLink";

const STORAGE_KEY = "wide.entityNav.collapsed";

export type EntityNavItem = {
  id: string;
  name: string;
  href: string;
  icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  exact?: boolean;
  external?: boolean;
};

export function EntityNavRail({
  items,
  footer,
}: {
  items: EntityNavItem[];
  footer?: ReactNode | ((collapsed: boolean) => ReactNode);
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "0") setCollapsed(false);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 shrink-0 self-start rounded-lg border border-border bg-surface ${
        collapsed ? "w-12" : "w-44"
      }`}
    >
      <div className="flex flex-col py-1.5">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href.split("?")[0]
            : pathname === item.href.split("?")[0] ||
              pathname.startsWith(`${item.href.split("?")[0]}/`);
          const Icon = item.icon;
          return (
            <HardLink
              key={item.id}
              href={item.href}
              title={item.name}
              className={`mx-1 my-0.5 inline-flex items-center gap-2 rounded-md min-h-10 ${
                collapsed ? "justify-center px-0" : "px-2.5"
              } ${
                active
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {ready && !collapsed ? (
                <span className="text-[12px] font-semibold truncate">{item.name}</span>
              ) : null}
            </HardLink>
          );
        })}
        {footer ? (
          <div className={`mx-1 mt-1 pt-1 border-t border-border ${collapsed ? "flex justify-center" : ""}`}>
            {typeof footer === "function" ? footer(collapsed) : footer}
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className={`mx-1 mt-1 inline-flex items-center min-h-9 rounded-md text-text-muted hover:bg-surface-raised hover:text-text-primary ${
            collapsed ? "justify-center" : "gap-2 px-2.5"
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
              <span className="text-[11px] font-semibold">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

