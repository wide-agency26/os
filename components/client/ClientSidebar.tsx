"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, BarChart3, Folder, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const CLIENT_NAV = [
  { name: "Brand Guidelines", href: "/app/client-guidelines", icon: BookOpen },
  { name: "Reports", href: "/app/client-reports", icon: BarChart3, badge: "Coming Soon" },
  { name: "Files", href: "/app/client-files", icon: Folder, badge: "Coming Soon" },
];

export function ClientSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-[#F9FAFB] border-r border-[#E5E7EB] h-screen text-[13px]">
      {/* Top Logo / Brand */}
      <div className="h-14 flex items-center px-4 border-b border-[#E5E7EB] shrink-0">
        <Link href="/app/client-guidelines" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs shadow-sm">
            W
          </div>
          <span className="font-semibold text-gray-900 tracking-wide group-hover:text-black transition-colors">
            WIDE Client Portal
          </span>
        </Link>
      </div>

      {/* Client Nav List (Exactly 3 Tabs) */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">
          Client Workspace
        </div>
        {CLIENT_NAV.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-200/70 text-gray-600 px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* User / Logout */}
      <div className="p-3 border-t border-[#E5E7EB] shrink-0">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-between px-3 py-2 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group"
        >
          <span className="font-medium text-xs">Sign Out</span>
          <LogOut size={14} className="text-gray-400 group-hover:text-red-600 transition-colors" />
        </button>
      </div>
    </aside>
  );
}
