"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { PillarPageShell } from "@/components/accounting/PillarPageShell";

export default function ActualLedgerPage() {
  return (
    <Workspace wide>
      <PillarPageShell
        pillar="actual"
        title="Actual"
        description="Live work. Signed deal revenue plus HR payroll and Resources costs. Auto rows stay locked — categorize them, or tuck a one-off Adjustment (bank fee, tax) here."
        runSyncOnMount
        groupMode="project"
      />
    </Workspace>
  );
}
