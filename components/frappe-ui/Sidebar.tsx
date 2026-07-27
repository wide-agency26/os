"use client";

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
  Command
} from "lucide-react";

const MODULES = [
  { name: "Home", href: "/app/home", icon: Home },
  { name: "Accounting", href: "/app/accounting", icon: FileText },
  { name: "CRM", href: "/app/crm", icon: Users },
  { name: "HR", href: "/app/hr", icon: Users },
  { name: "Projects", href: "/app/projects", icon: Briefcase },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col bg-[#F9FAFB] border-r border-[#E5E7EB] h-screen text-[13px]">
      {/* Top Logo / Brand */}
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

      {/* Awesomebar Trigger (Mobile/Alternative) */}
      <div className="p-3">
        <button className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-md text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all shadow-sm">
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

      {/* Modules List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3 mt-2">
          Modules
        </div>
        {MODULES.map((mod) => {
          const isActive = pathname.startsWith(mod.href);
          const Icon = mod.icon;
          return (
            <Link
              key={mod.name}
              href={mod.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-gray-200/60 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon size={16} className={isActive ? "text-gray-800" : "text-gray-400"} />
              {mod.name}
            </Link>
          );
        })}
      </div>

      {/* User Section */}
      <div className="p-3 border-t border-[#E5E7EB] shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-md cursor-pointer transition-colors group">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-gray-700 to-gray-900 text-white flex items-center justify-center font-medium shadow-inner">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">Admin User</p>
            <p className="text-[11px] text-gray-500 truncate">System Manager</p>
          </div>
          <LogOut size={14} className="text-gray-400 group-hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-all" />
        </div>
      </div>
    </aside>
  );
}
