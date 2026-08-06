import { Suspense } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ClientsHub } from "@/components/pm/ClientsHub";

export default function ClientsWorkspace() {
  return (
    <Workspace>
      <Suspense
        fallback={<p className="text-sm text-gray-500">Loading clients…</p>}
      >
        <ClientsHub />
      </Suspense>
    </Workspace>
  );
}
