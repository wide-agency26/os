"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { PillarPageShell } from "@/components/accounting/PillarPageShell";

export default function ActualLedgerPage() {
  return (
    <Workspace wide>
      <PillarPageShell
        pillar="actual"
        title="Actual"
        description="Signed revenue and real costs — HR &amp; overhead run-rate, plus delivered project revenue and assignment costs."
        runSyncOnMount
        groupMode="project"
      />
    </Workspace>
  );
}
