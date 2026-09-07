"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { ContractBuilder } from "@/components/bd/ContractBuilder";
import {
  confirmProjectContract,
  ensureProjectBdRecord,
  refreshContractFromSow,
} from "@/app/actions/projects-commercial";
import { generateBdContract } from "@/app/actions/bd";
import { contractTotal, mergeContract } from "@/lib/bd/contract";
import { formatEuro } from "@/lib/accounting/types";

export function ProjectContractPanel({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState("Project");
  const [clientLabel, setClientLabel] = useState<string | undefined>();
  const [bdRecordId, setBdRecordId] = useState<string | null>(null);
  const [contract, setContract] = useState<Record<string, unknown> | null>(null);
  const [sowConfirmed, setSowConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: project } = await supabase
      .from("projects")
      .select(
        "id, title, client_id, company, bd_record_id, contract_confirmed_at, crm_customers:client_id ( company, name )"
      )
      .eq("id", projectId)
      .maybeSingle();
    setTitle(project?.title || "Project");
    const co = Array.isArray(project?.crm_customers)
      ? project?.crm_customers[0]
      : project?.crm_customers;
    setClientLabel(co?.company || co?.name || project?.company || undefined);
    setConfirmed(Boolean(project?.contract_confirmed_at));

    const { data: sows } = await supabase
      .from("sows")
      .select("status")
      .eq("project_id", projectId);
    setSowConfirmed((sows || []).some((s: { status: string }) => s.status === "accepted"));

    let bdId = project?.bd_record_id as string | null;
    if (!bdId) {
      const ensured = await ensureProjectBdRecord(projectId);
      bdId = ensured.bdRecordId || null;
    }
    setBdRecordId(bdId);
    if (bdId) {
      const { data: rec } = await supabase
        .from("bd_records")
        .select("contract")
        .eq("id", bdId)
        .maybeSingle();
      setContract((rec?.contract as Record<string, unknown>) || {});
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  const total = contractTotal(mergeContract(contract).line_items);

  return (
    <ProjectPmShell projectId={projectId} title={title} clientLabel={clientLabel}>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      ) : !bdRecordId ? (
        <p className="text-sm text-gray-500">Could not attach a contract record.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 sticky top-0 z-10">
            <div>
              <p className="text-lg font-semibold text-gray-950 tabular-nums">
                {formatEuro(total)}{" "}
                <span className="text-xs font-normal text-gray-500">net</span>
              </p>
              <p className="text-[11px] text-gray-500">
                {sowConfirmed
                  ? "SOW confirmed — you can start the project."
                  : "Confirm the SOW before starting the project."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || confirmed}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Refresh line items from SOW? Edited parties, clauses, and preamble stay when already filled."
                    )
                  ) {
                    return;
                  }
                  setMessage(null);
                  startTransition(async () => {
                    const res = await refreshContractFromSow({ projectId });
                    setMessage(res.ok ? "Refreshed from SOW." : res.error || "Refresh failed");
                    await load();
                  });
                }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Refresh from SOW
              </button>
              <button
                type="button"
                disabled={pending || confirmed}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Generate / regenerate draft from proposal context? Existing filled fields are preserved."
                    )
                  ) {
                    return;
                  }
                  setMessage(null);
                  startTransition(async () => {
                    const res = await generateBdContract({ bdRecordId });
                    setMessage(res.ok ? "Draft generated." : res.error || "Generate failed");
                    await load();
                  });
                }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Generate
              </button>
              <button
                type="button"
                disabled={pending || confirmed || !sowConfirmed}
                onClick={() => {
                  setMessage(null);
                  startTransition(async () => {
                    const res = await confirmProjectContract({ projectId });
                    setMessage(
                      res.ok
                        ? "Contract confirmed — project is live."
                        : res.error || "Confirm failed"
                    );
                    await load();
                  });
                }}
                className="rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {confirmed ? "Project started" : "Confirm contract & start project"}
              </button>
            </div>
          </div>
          {message && <p className="text-xs text-gray-600">{message}</p>}
          <ContractBuilder
            bdRecordId={bdRecordId}
            companyName={clientLabel || title}
            initial={contract}
            onSaved={() => void load()}
          />
        </div>
      )}
    </ProjectPmShell>
  );
}
