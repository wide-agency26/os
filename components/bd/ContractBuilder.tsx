"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import {
  finalizeBdContract,
  generateBdContract,
  saveBdContract,
} from "@/app/actions/bd";
import {
  contractTotal,
  mergeContract,
  type BdContractClause,
  type BdContractLineItem,
  type BdContractPayload,
} from "@/lib/bd/contract";

export function ContractBuilder({
  bdRecordId,
  companyName,
  initial,
}: {
  bdRecordId: string;
  companyName: string;
  initial: Record<string, unknown> | null | undefined;
}) {
  const router = useRouter();
  const [contract, setContract] = useState<BdContractPayload>(
    mergeContract(initial)
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function setLine(idx: number, patch: Partial<BdContractLineItem>) {
    setContract((c) => ({
      ...c,
      line_items: c.line_items.map((li, i) =>
        i === idx ? { ...li, ...patch } : li
      ),
    }));
  }

  function setClause(idx: number, patch: Partial<BdContractClause>) {
    setContract((c) => ({
      ...c,
      clauses: c.clauses.map((cl, i) => (i === idx ? { ...cl, ...patch } : cl)),
    }));
  }

  function generate() {
    setMessage(null);
    startTransition(async () => {
      const res = await generateBdContract({ bdRecordId });
      if (!res.ok) {
        setMessage(res.error || "Generate failed");
        return;
      }
      if (res.contract) {
        setContract(mergeContract(res.contract));
      }
      setMessage("Draft generated from proposal context.");
      router.refresh();
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const res = await saveBdContract({
        bdRecordId,
        contract: contract as unknown as Record<string, unknown>,
      });
      if (!res.ok) {
        setMessage(res.error || "Save failed");
        return;
      }
      setMessage("Contract saved.");
      router.refresh();
    });
  }

  function finalize() {
    if (
      !window.confirm(
        "Finalize this contract and move the BD record to Quotation?"
      )
    )
      return;
    setMessage(null);
    startTransition(async () => {
      const res = await finalizeBdContract({
        bdRecordId,
        contract: contract as unknown as Record<string, unknown>,
      });
      if (!res.ok) {
        setMessage(res.error || "Finalize failed");
        return;
      }
      setContract((c) => ({ ...c, status: "finalized" }));
      setMessage("Finalized — stage is now quotation (Lexware next).");
      router.refresh();
    });
  }

  const total = contractTotal(contract.line_items);
  const hasContent =
    contract.line_items.length > 0 ||
    (contract.parties.client_name && contract.parties.client_name.length > 0);

  return (
    <div className="space-y-6 py-2 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Contract Builder
          </p>
          <h1 className="text-2xl font-semibold text-gray-950">
            {contract.title || companyName}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Status: {contract.status} ·{" "}
            <Link href={`/app/bd/${bdRecordId}`} className="text-blue-700">
              BD record
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={generate}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            {hasContent ? "Regenerate" : "Generate draft"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <Save size={14} /> Save
          </button>
          <button
            type="button"
            disabled={pending || contract.status === "finalized"}
            onClick={finalize}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> Finalize → Quotation
          </button>
        </div>
      </div>

      {message && (
        <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Title
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          value={contract.title}
          onChange={(e) => setContract({ ...contract, title: e.target.value })}
        />
      </label>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Parties
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ["agency_name", "Agency"],
              ["agency_address", "Agency address"],
              ["client_name", "Client company"],
              ["client_contact", "Client contact"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1 text-xs font-medium text-gray-700">
              {label}
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={contract.parties[key]}
                onChange={(e) =>
                  setContract({
                    ...contract,
                    parties: { ...contract.parties, [key]: e.target.value },
                  })
                }
              />
            </label>
          ))}
          <label className="block space-y-1 text-xs font-medium text-gray-700 sm:col-span-2">
            Client email
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={contract.parties.client_email || ""}
              onChange={(e) =>
                setContract({
                  ...contract,
                  parties: {
                    ...contract.parties,
                    client_email: e.target.value || null,
                  },
                })
              }
            />
          </label>
        </div>
      </section>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Preamble
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[80px]"
          value={contract.preamble}
          onChange={(e) =>
            setContract({ ...contract, preamble: e.target.value })
          }
        />
      </label>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Line items
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold"
            onClick={() =>
              setContract({
                ...contract,
                line_items: [
                  ...contract.line_items,
                  {
                    id: crypto.randomUUID(),
                    title: "New line",
                    description: "",
                    price: null,
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Add
          </button>
        </div>
        {contract.line_items.map((li, idx) => (
          <div
            key={li.id}
            className="rounded-xl border border-gray-200 bg-white p-3 space-y-2"
          >
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                value={li.title}
                onChange={(e) => setLine(idx, { title: e.target.value })}
              />
              <input
                type="number"
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="EUR"
                value={li.price ?? ""}
                onChange={(e) =>
                  setLine(idx, {
                    price:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
              <button
                type="button"
                className="p-2 text-red-600"
                onClick={() =>
                  setContract({
                    ...contract,
                    line_items: contract.line_items.filter((_, i) => i !== idx),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[56px]"
              value={li.description}
              onChange={(e) => setLine(idx, { description: e.target.value })}
            />
          </div>
        ))}
        <p className="text-sm font-semibold text-gray-900">
          Subtotal: {total.toLocaleString("de-DE", {
            style: "currency",
            currency: "EUR",
          })}{" "}
          <span className="text-xs font-normal text-gray-500">
            (+19% VAT unless noted)
          </span>
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Clauses (DE)
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold"
            onClick={() =>
              setContract({
                ...contract,
                clauses: [
                  ...contract.clauses,
                  {
                    id: crypto.randomUUID(),
                    title: "New clause",
                    body: "",
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Add clause
          </button>
        </div>
        {contract.clauses.map((cl, idx) => (
          <div
            key={cl.id}
            className="rounded-xl border border-gray-200 bg-white p-3 space-y-2"
          >
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                value={cl.title}
                onChange={(e) => setClause(idx, { title: e.target.value })}
              />
              <button
                type="button"
                className="p-2 text-red-600"
                onClick={() =>
                  setContract({
                    ...contract,
                    clauses: contract.clauses.filter((_, i) => i !== idx),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
            <textarea
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
              value={cl.body}
              onChange={(e) => setClause(idx, { body: e.target.value })}
            />
          </div>
        ))}
      </section>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Internal notes
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[56px]"
          value={contract.notes || ""}
          onChange={(e) =>
            setContract({ ...contract, notes: e.target.value || null })
          }
        />
      </label>
    </div>
  );
}
