"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ResourcesCatalog } from "@/components/resources/ResourcesCatalog";

function ResourcesInner() {
  const search = useSearchParams();
  const tab = search.get("tab");
  const initialTab =
    tab === "people"
      ? "person"
      : tab === "office" || tab === "marketing" || tab === "unassigned" || tab === "person" || tab === "project"
        ? tab
        : "all";
  return <ResourcesCatalog initialTab={initialTab} />;
}

export default function ResourcesPage() {
  return (
    <Workspace wide>
      <Suspense fallback={<p className="text-[13px] text-gray-500">Loading resources…</p>}>
        <ResourcesInner />
      </Suspense>
    </Workspace>
  );
}
