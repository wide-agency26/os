"use client";

import { Search, Bell, HelpCircle } from "lucide-react";

interface AwesomebarProps {
  title: string;
}

export function Awesomebar({ title }: AwesomebarProps) {
  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[#E5E7EB] bg-white shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        <div className="relative w-64 hidden sm:block">
          <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search or type a command (Ctrl+G)"
            className="w-full h-8 pl-8 pr-3 bg-gray-100 border-transparent rounded text-xs focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none"
          />
        </div>
        
        <button className="text-gray-400 hover:text-gray-700 transition-colors">
          <HelpCircle size={18} />
        </button>
        <button className="text-gray-400 hover:text-gray-700 transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
      </div>
    </header>
  );
}
