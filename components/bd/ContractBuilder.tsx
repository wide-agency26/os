"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2, CheckCircle2 } from "lucide-react";
import { workPaths } from "@/lib/work/paths";
import {
  finalizeBdContract,
  generateBdContract,
  saveBdContract,
} from "@/app/actions/bd";
import {
  applyAutoPreamble,
  clausesFromNumberedLines,
  contractTotal,
  mergeContract,
  nextSubClauseTitle,
  parseNumberedPaste,
  type BdContractClause,
  type BdContractLineItem,
  type BdContractParties,
  type BdContractPayload,
} from "@/lib/bd/contract";

const AUTOSAVE_MS = 1500;

export function ContractBuilder({
  bdRecordId,
  companyName,
  initial,
  onSaved,
}: {
  bdRecordId: string;
  companyName: string;
  initial: Record<string, unknown> | null | undefined;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [contract, setContract] = useState<BdContractPayload>(() =>
    mergeContract(initial)
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const contractRef = useRef(contract);
  const dirtyRef = useRef(false);
  const lastSyncedAt = useRef<string | null>(
    mergeContract(initial).updated_at
  );
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    contractRef.current = contract;
  }, [contract]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const next = mergeContract(initial);
    const nextAt = next.updated_at;
    if (dirtyRef.current) return;
    if (nextAt && nextAt === lastSyncedAt.current) return;
    // Avoid wiping local edits when parent remounts with same empty {}
    if (!nextAt && lastSyncedAt.current) return;
    setContract(next);
    lastSyncedAt.current = nextAt;
  }, [initial]);

  const persist = useCallback(
    async (payload: BdContractPayload, opts?: { silent?: boolean }) => {
      setSaveState("saving");
      const res = await saveBdContract({
        bdRecordId,
        contract: payload as unknown as Record<string, unknown>,
      });
      if (!res.ok) {
        setSaveState("error");
        if (!opts?.silent) setMessage(res.error || "Save failed");
        return false;
      }
      lastSyncedAt.current = payload.updated_at || new Date().toISOString();
      setDirty(false);
      dirtyRef.current = false;
      setSaveState("saved");
      onSaved?.();
      if (!opts?.silent) {
        setMessage("Contract saved.");
        router.refresh();
      }
      return true;
    },
    [bdRecordId, onSaved, router]
  );

  const scheduleAutosave = useCallback(
    (next: BdContractPayload) => {
      setDirty(true);
      dirtyRef.current = true;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        const stamped = {
          ...contractRef.current,
          updated_at: new Date().toISOString(),
        };
        void persist(stamped, { silent: true });
      }, AUTOSAVE_MS);
    },
    [persist]
  );

  const patchContract = useCallback(
    (updater: (c: BdContractPayload) => BdContractPayload) => {
      setContract((prev) => {
        const next = updater(prev);
        contractRef.current = next;
        scheduleAutosave(next);
        return next;
      });
    },
    [scheduleAutosave]
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function setParty(key: keyof BdContractParties, value: string | null) {
    patchContract((c) =>
      applyAutoPreamble({
        ...c,
        parties: {
          ...c.parties,
          [key]: value,
          ...(key === "client_poc" ? { client_contact: value || "" } : {}),
          ...(key === "client_contact" ? { client_poc: value || c.parties.client_poc } : {}),
        },
      })
    );
  }

  function setLine(idx: number, patch: Partial<BdContractLineItem>) {
    patchContract((c) => ({
      ...c,
      line_items: c.line_items.map((li, i) =>
        i === idx ? { ...li, ...patch } : li
      ),
    }));
  }

  function setClause(idx: number, patch: Partial<BdContractClause>) {
    patchContract((c) => ({
      ...c,
      clauses: c.clauses.map((cl, i) => (i === idx ? { ...cl, ...patch } : cl)),
    }));
  }

  function addSubClause(parentIdx: number) {
    patchContract((c) => {
      const title = nextSubClauseTitle(c.clauses, parentIdx);
      const next = [...c.clauses];
      let insertAt = parentIdx + 1;
      while (insertAt < next.length && (next[insertAt].level || 1) === 2) {
        insertAt += 1;
      }
      next.splice(insertAt, 0, {
        id: crypto.randomUUID(),
        title,
        body: "",
        level: 2,
      });
      return { ...c, clauses: next };
    });
  }

  function handleClauseTitleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) {
    const cl = contract.clauses[idx];
    if (e.key === "Tab" && !e.shiftKey && (cl.level || 1) === 1) {
      e.preventDefault();
      if (idx === 0) return;
      patchContract((c) => {
        let parentIdx = idx - 1;
        while (parentIdx >= 0 && (c.clauses[parentIdx].level || 1) === 2) {
          parentIdx -= 1;
        }
        if (parentIdx < 0) return c;
        const without = c.clauses.filter((_, i) => i !== idx);
        const title = nextSubClauseTitle(without, parentIdx);
        const row = {
          ...c.clauses[idx],
          level: 2 as const,
          title:
            c.clauses[idx].title.startsWith("§") ||
            c.clauses[idx].title === "New clause"
              ? title
              : c.clauses[idx].title,
        };
        const next = [...without];
        let insertAt = parentIdx + 1;
        while (insertAt < next.length && (next[insertAt].level || 1) === 2) {
          insertAt += 1;
        }
        next.splice(insertAt, 0, row);
        return { ...c, clauses: next };
      });
      return;
    }
    if (e.key === "Tab" && e.shiftKey && (cl.level || 1) === 2) {
      e.preventDefault();
      patchContract((c) => ({
        ...c,
        clauses: c.clauses.map((row, i) =>
          i === idx ? { ...row, level: 1 as const } : row
        ),
      }));
    }
  }

  function handleClausePaste(
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    idx: number
  ) {
    const text = e.clipboardData.getData("text/plain");
    const lines = parseNumberedPaste(text);
    if (lines.length < 2) return;
    e.preventDefault();
    const bodyEmpty = !contract.clauses[idx]?.body?.trim();
    if (bodyEmpty && lines.length >= 2) {
      const created = clausesFromNumberedLines(lines);
      patchContract((c) => {
        const next = [...c.clauses];
        next.splice(idx, 1, ...created);
        return { ...c, clauses: next };
      });
      setMessage(`Imported ${created.length} numbered lines from paste.`);
      return;
    }
    setClause(idx, {
      body: [contract.clauses[idx].body, lines.join("\n")].filter(Boolean).join("\n"),
    });
  }

  function generate() {
    const hasContent =
      contract.line_items.length > 0 ||
      Boolean(contract.parties.client_name) ||
      contract.clauses.some((c) => c.body.trim());
    if (
      hasContent &&
      !window.confirm(
        "Regenerate from proposal/SOW? Line items refresh from SOW; your edited parties, clauses, and preamble are kept when already filled."
      )
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      if (dirtyRef.current) {
        await persist(
          { ...contractRef.current, updated_at: new Date().toISOString() },
          { silent: true }
        );
      }
      const res = await generateBdContract({ bdRecordId });
      if (!res.ok) {
        setMessage(res.error || "Generate failed");
        return;
      }
      if (res.contract) {
        const merged = mergeContract(res.contract);
        setContract(merged);
        contractRef.current = merged;
        lastSyncedAt.current = merged.updated_at;
        setDirty(false);
      }
      setMessage("Draft generated from proposal / CRM (merged into existing).");
      onSaved?.();
      router.refresh();
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const stamped = {
        ...contractRef.current,
        updated_at: new Date().toISOString(),
      };
      setContract(stamped);
      await persist(stamped);
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
      if (dirtyRef.current) {
        await persist(
          { ...contractRef.current, updated_at: new Date().toISOString() },
          { silent: true }
        );
      }
      const res = await finalizeBdContract({
        bdRecordId,
        contract: contractRef.current as unknown as Record<string, unknown>,
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

  const partyFields: { key: keyof BdContractParties; label: string; optional?: boolean }[] = [
    { key: "agency_name", label: "Agency company" },
    { key: "agency_poc", label: "Agency POC", optional: true },
    { key: "agency_address", label: "Agency address" },
    { key: "agency_tax_id", label: "Agency Tax ID / Handelsregister", optional: true },
    { key: "client_name", label: "Client company" },
    { key: "client_poc", label: "Client POC", optional: true },
    { key: "client_address", label: "Client address" },
    { key: "client_tax_id", label: "Client Tax ID / Handelsregister", optional: true },
  ];

  return (
    <div className="space-y-6 py-2">
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
            <Link href={workPaths.pipelineId(bdRecordId)} className="text-blue-700">
              BD record
            </Link>
            {" · "}
            {saveState === "saving"
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save error"
                    : "Autosave on"}
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
          onChange={(e) =>
            patchContract((c) => ({ ...c, title: e.target.value }))
          }
        />
      </label>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Parties
          </h2>
          <button
            type="button"
            disabled={pending}
            className="text-xs font-semibold text-blue-700 disabled:opacity-50"
            onClick={generate}
            title="Pull company / contact / email from BD + CRM; keeps filled fields"
          >
            Pull from client
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {partyFields.map(({ key, label, optional }) => (
            <label key={key} className="block space-y-1 text-xs font-medium text-gray-700">
              {label}
              {optional ? (
                <span className="text-gray-400 font-normal"> (optional)</span>
              ) : null}
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={contract.parties[key] || ""}
                onChange={(e) => setParty(key, e.target.value)}
              />
            </label>
          ))}
          <label className="block space-y-1 text-xs font-medium text-gray-700 sm:col-span-2">
            Client email
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={contract.parties.client_email || ""}
              onChange={(e) => setParty("client_email", e.target.value || null)}
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
            patchContract((c) => ({ ...c, preamble: e.target.value }))
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
              patchContract((c) => ({
                ...c,
                line_items: [
                  ...c.line_items,
                  {
                    id: crypto.randomUUID(),
                    title: "New line",
                    description: "",
                    price: null,
                  },
                ],
              }))
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
                onChange={(e) => setLine(idx, { title: e.target.value, from_sow: false })}
              />
              {li.from_sow ? (
                <span className="self-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  From SOW
                </span>
              ) : null}
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
                  patchContract((c) => ({
                    ...c,
                    line_items: c.line_items.filter((_, i) => i !== idx),
                  }))
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
              patchContract((c) => ({
                ...c,
                clauses: [
                  ...c.clauses,
                  {
                    id: crypto.randomUUID(),
                    title: `§${c.clauses.filter((x) => (x.level || 1) === 1).length + 1}`,
                    body: "",
                    level: 1,
                  },
                ],
              }))
            }
          >
            <Plus size={14} /> Add clause
          </button>
        </div>
        {contract.clauses.map((cl, idx) => {
          const level = cl.level || 1;
          return (
            <div
              key={cl.id}
              className={`rounded-xl border border-gray-200 bg-white p-3 space-y-2 ${
                level === 2 ? "ml-6 border-l-4 border-l-gray-300" : ""
              }`}
            >
              <div className="flex gap-2 flex-wrap">
                <input
                  className="flex-1 min-w-[160px] rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold"
                  value={cl.title}
                  onChange={(e) => setClause(idx, { title: e.target.value })}
                  onKeyDown={(e) => handleClauseTitleKeyDown(e, idx)}
                  title="Tab nest · Shift+Tab promote"
                />
                {level === 1 ? (
                  <button
                    type="button"
                    className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700"
                    onClick={() => addSubClause(idx)}
                  >
                    + Sub-clause
                  </button>
                ) : (
                  <span className="self-center text-[10px] uppercase tracking-wide text-gray-400">
                    Sub
                  </span>
                )}
                <button
                  type="button"
                  className="p-2 text-red-600"
                  onClick={() =>
                    patchContract((c) => ({
                      ...c,
                      clauses: c.clauses.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <textarea
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[72px]"
                value={cl.body}
                onChange={(e) => setClause(idx, { body: e.target.value })}
                onPaste={(e) => handleClausePaste(e, idx)}
                placeholder="Paste numbered lists from Sheets here…"
              />
            </div>
          );
        })}
      </section>

      <label className="block space-y-1 text-xs font-medium text-gray-700">
        Internal notes
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[56px]"
          value={contract.notes || ""}
          onChange={(e) =>
            patchContract((c) => ({ ...c, notes: e.target.value || null }))
          }
        />
      </label>
    </div>
  );
}
