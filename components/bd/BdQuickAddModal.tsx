"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { createBdRecord } from "@/app/actions/bd";
import type { BdStaffOption } from "@/lib/bd/types";

export function BdQuickAddModal({
  open,
  onClose,
  staff,
  defaultOwnerId,
}: {
  open: boolean;
  onClose: () => void;
  staff: BdStaffOption[];
  defaultOwnerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [observerIds, setObserverIds] = useState<string[]>([]);

  const observerOptions = useMemo(
    () => staff.filter((s) => s.id !== ownerId),
    [staff, ownerId]
  );

  if (!open) return null;

  function reset() {
    setName("");
    setCompany("");
    setPosition("");
    setEmail("");
    setPhone("");
    setLinkedin("");
    setOwnerId(defaultOwnerId);
    setObserverIds([]);
    setError(null);
  }

  function toggleObserver(id: string) {
    setObserverIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createBdRecord({
        name,
        company_name: company,
        position: position || null,
        email: email || null,
        phone: phone || null,
        linkedin_url: linkedin || null,
        owner_id: ownerId,
        observer_ids: observerIds,
      });
      if (!res.ok) {
        setError(res.error || "Could not create record");
        return;
      }
      reset();
      onClose();
      router.refresh();
      if (res.id) router.push(`/app/bd/${res.id}`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add prospect</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Creates a CRM company + contact, then a BD pipeline card. No delete —
              archive later if needed.
            </p>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
            onClick={onClose}
            disabled={pending}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <label className="block space-y-1 text-xs font-medium text-gray-700">
            Name *
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact name"
              autoFocus
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-gray-700">
            Company *
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-gray-700">
            Position
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-xs font-medium text-gray-700">
              Email
              <input
                type="email"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs font-medium text-gray-700">
              Phone
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          </div>
          <label className="block space-y-1 text-xs font-medium text-gray-700">
            LinkedIn URL
            <input
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/…"
            />
          </label>

          <label className="block space-y-1 text-xs font-medium text-gray-700">
            Owner *
            <select
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
              value={ownerId}
              onChange={(e) => {
                const next = e.target.value;
                setOwnerId(next);
                setObserverIds((prev) => prev.filter((id) => id !== next));
              }}
            >
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-700">Observers (optional)</p>
            <p className="text-[11px] text-gray-500">
              Notified on updates — distinct from the owner.
            </p>
            <div className="max-h-28 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1">
              {observerOptions.length === 0 ? (
                <p className="text-xs text-gray-400 px-1 py-1">No other staff</p>
              ) : (
                observerOptions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-xs text-gray-700 px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={observerIds.includes(s.id)}
                      onChange={() => toggleObserver(s.id)}
                    />
                    {s.full_name || s.id.slice(0, 8)}
                  </label>
                ))
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-50"
            onClick={submit}
            disabled={pending || !name.trim() || !company.trim() || !ownerId}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create prospect
          </button>
        </div>
      </div>
    </div>
  );
}
