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
        description="Lead deals — identified revenue and cost that aren't signed clients yet."
        runSyncOnMount
        groupMode="project"
        headerExtra={
          <div className="flex items-center gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <Info size={14} className="shrink-0" />
            <span className="flex-1">
              Lead-stage projects land here. Moving a project to Client (signed) or
              Completed migrates these auto rows to Actual.
            </span>
            <Link
              href="/app/projects/project"
              className="font-medium underline whitespace-nowrap flex items-center gap-1 shrink-0"
            >
              Manage projects <ArrowRight size={12} />
            </Link>
          </div>
        }
        footerExtra={<ActivityFeed />}
      />
    </Workspace>
  );
}
