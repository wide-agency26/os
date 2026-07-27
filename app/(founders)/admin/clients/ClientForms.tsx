"use client";

import { useActionState, useState } from "react";
import { createWorkspace, deleteWorkspace, type AdminClientState } from "@/app/actions/admin-clients";

export function CreateWorkspaceForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminClientState, FormData>(createWorkspace, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#00FF00] px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-[#00FF00]/90"
      >
        + Add Client Workspace
      </button>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-50">New Workspace</h3>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
          Close
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        {state.error && <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">{state.error}</div>}
        {state.success && <div className="rounded-lg bg-[#00FF00]/10 p-3 text-sm text-[#00FF00]">{state.success}</div>}

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Company Name</span>
            <input
              name="company_name"
              required
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
              placeholder="Acme Corp"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Contact Name (Optional)</span>
            <input
              name="contact_name"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
              placeholder="Jane Doe"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Tier</span>
            <select
              name="current_tier"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            >
              <option value="Lead">Lead</option>
              <option value="Launch Kit">Launch Kit</option>
              <option value="Startup Launch">Startup Launch</option>
              <option value="Growth Program">Growth Program</option>
              <option value="Full Partnership">Full Partnership</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Lifecycle</span>
            <select
              name="lifecycle_status"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            >
              <option value="Lead">Lead</option>
              <option value="Prospect">Prospect</option>
              <option value="Active">Active</option>
              <option value="Partner">Partner</option>
              <option value="Closed">Closed</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Estimated Value ($)</span>
            <input
              name="estimated_value"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Workspace"}
        </button>
      </form>
    </div>
  );
}

export function DeleteWorkspaceButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this workspace and all associated data? This is irreversible.")) return;
    setPending(true);
    await deleteWorkspace(id);
    setPending(false);
  };

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-xs font-semibold text-rose-500 hover:text-rose-400 disabled:opacity-50"
      title="Delete Workspace"
    >
      {pending ? "..." : "Remove"}
    </button>
  );
}
