"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { PillarPageShell } from "@/components/accounting/PillarPageShell";

export default function UnidentifiedLedgerPage() {
  return (
    <Workspace wide>
      <PillarPageShell
        pillar="unidentified"
        title="Unidentified"
        description="Speculative pipeline revenue &amp; cost — not yet tied to a specific company, client, or project."
        showConfidence
        groupMode="category"
      />
    </Workspace>
  );
}
