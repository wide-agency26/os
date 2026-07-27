

import { ReactNode } from "react";

interface WorkspaceProps {
  children: ReactNode;
}

export function Workspace({ children }: WorkspaceProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-5xl mx-auto p-8">
        {children}
      </div>
    </div>
  );
}

// Frappe-style standardized card components
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-[13px] font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function ShortcutCard({ title, icon: Icon, href, count }: { title: string; icon: any; href: string; count?: number }) {
  return (
    <a href={href} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group">
      <div className="flex items-center gap-3">
        <div className="text-gray-400 group-hover:text-blue-500 transition-colors">
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{title}</span>
      </div>
      {count !== undefined && (
        <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </a>
  );
}

export function MasterList({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <a key={item.label} href={item.href} className="text-[13px] text-gray-600 hover:text-blue-600 transition-colors">
          {item.label}
        </a>
      ))}
    </div>
  );
}
