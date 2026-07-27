import { ReactNode } from "react";
import { Sidebar } from "@/components/frappe-ui/Sidebar";
import { Awesomebar } from "@/components/frappe-ui/Awesomebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-white overflow-hidden text-gray-900 antialiased selection:bg-blue-100 selection:text-blue-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Awesomebar title="WIDE OS Workspace" />
        {children}
      </div>
    </div>
  );
}
