"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { PillarPageShell } from "@/components/accounting/PillarPageShell";

export default function UnidentifiedLedgerPage() {
  return (
    <Workspace wide>
      <PillarPageShell
        pillar="unidentified"
        title="Unidentified"
        description="Prospect / speculative pipeline — not yet a lead or client. Project stage Prospect lands here."
        showConfidence
        runSyncOnMount
        groupMode="category"
      />
    </Workspace>
  );
}
