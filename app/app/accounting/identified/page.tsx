"use client";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PillarPageShell } from "@/components/accounting/PillarPageShell";
import { ActivityFeed } from "@/components/accounting/ActivityFeed";

export default function IdentifiedLedgerPage() {
  return (
    <Workspace wide>
      <PillarPageShell
        pillar="identified"
        title="Identified"
        description="Propose / Contract. Priced SOWs and quotes — Identified uses the lower published net when a version family exists."
        runSyncOnMount
        groupMode="project"
        headerExtra={
          <div className="flex items-center gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <Info size={14} className="shrink-0" />
            <span className="flex-1">
              Lead projects and priced SOWs land here. Identified uses the lower
              published/accepted net when a version family exists. Confirming the
              contract moves the deal to Actual.
            </span>
            <Link
              href="/app/work?filter=propose"
              className="font-medium underline whitespace-nowrap flex items-center gap-1 shrink-0"
            >
              Open Propose <ArrowRight size={12} />
            </Link>
          </div>
        }
        footerExtra={<ActivityFeed />}
      />
    </Workspace>
  );
}
