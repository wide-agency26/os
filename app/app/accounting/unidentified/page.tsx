"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { PillarPageShell } from "@/components/accounting/PillarPageShell";

export default function UnidentifiedLedgerPage() {
  return (
    <Workspace wide>
      <PillarPageShell
        pillar="unidentified"
        title="Unidentified"
        description="Find / Qualify. Pipeline value from Work until a priced Propose/Contract deal exists."
        showConfidence
        runSyncOnMount
        groupMode="project"
        headerExtra={
          <div className="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            Amounts come from Work deal values on Find/Qualify companies. Open{" "}
            <a href="/app/work?filter=find" className="font-medium text-blue-700 hover:underline">
              Find
            </a>
            {" or "}
            <a href="/app/work?filter=qualify" className="font-medium text-blue-700 hover:underline">
              Qualify
            </a>
            . Once a deal is priced, euros move to Identified. Unlabeled future
            volume lives in{" "}
            <a href="/app/accounting/projections" className="font-medium text-blue-700 hover:underline">
              Projections
            </a>
            .
          </div>
        }
      />
    </Workspace>
  );
}
