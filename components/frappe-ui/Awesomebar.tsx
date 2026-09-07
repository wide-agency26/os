"use client";

import { Menu } from "lucide-react";
import { useMobileNav } from "@/components/frappe-ui/MobileNav";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface AwesomebarProps {
  title: string;
  showNotifications?: boolean;
}

export function Awesomebar({ title, showNotifications = false }: AwesomebarProps) {
  const { toggle, open } = useMobileNav();

  return (
    <header
      className="os-chrome-header flex items-center gap-2 px-3 md:px-6 border-b border-border bg-surface shrink-0"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        minHeight: "calc(3.5rem + env(safe-area-inset-top))",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="md:hidden inline-flex items-center justify-center w-11 h-11 -ml-1 rounded-md text-text-primary hover:bg-surface-raised"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>
      <h1 className="text-[15px] font-semibold text-text-primary tracking-tight truncate min-w-0">
        {title}
      </h1>
      {showNotifications ? <NotificationCenter /> : <div className="ml-auto" />}
    </header>
  );
}
