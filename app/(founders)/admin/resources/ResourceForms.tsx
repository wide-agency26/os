"use client";

import { useActionState, useState } from "react";
import { addPerson, deletePerson, addResource, deleteResource, type AdminResourceState } from "@/app/actions/admin-resources";

export function AddPersonForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminResourceState, FormData>(addPerson, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#00FF00] px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-[#00FF00]/90"
      >
        + Add Person
      </button>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-left">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-50">New Team Member</h3>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
          Close
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        {state.error && <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">{state.error}</div>}
        {state.success && <div className="rounded-lg bg-[#00FF00]/10 p-3 text-sm text-[#00FF00]">{state.success}</div>}

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Full Name</span>
            <input
              name="full_name"
              required
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
              placeholder="Jane Doe"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Role Type</span>
            <select
              name="person_type"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            >
              <option value="Employee">Employee</option>
              <option value="Intern">Intern</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Founder">Founder</option>
              <option value="Partner_Contact">Partner Contact</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Hourly Rate Cost ($)</span>
            <input
              name="hourly_rate_cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Capacity Score (0-100)</span>
            <input
              name="capacity_score"
              type="number"
              min="0"
              max="100"
              defaultValue="100"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Add Person"}
        </button>
      </form>
    </div>
  );
}

export function DeletePersonButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this person?")) return;
    setPending(true);
    await deletePerson(id);
    setPending(false);
  };

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-xs font-semibold text-rose-500 hover:text-rose-400 disabled:opacity-50"
      title="Delete Person"
    >
      {pending ? "..." : "Remove"}
    </button>
  );
}

export function AddResourceForm({ type }: { type: "Tool" | "Other_Resource" }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminResourceState, FormData>(addResource, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#00FF00] px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-[#00FF00]/90"
      >
        + Add {type === "Tool" ? "Tool" : "Resource"}
      </button>
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-left">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-50">New {type === "Tool" ? "Tool" : "Resource"}</h3>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
          Close
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        {state.error && <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">{state.error}</div>}
        {state.success && <div className="rounded-lg bg-[#00FF00]/10 p-3 text-sm text-[#00FF00]">{state.success}</div>}

        <input type="hidden" name="resource_type" value={type} />

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Name</span>
            <input
              name="resource_name"
              required
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
              placeholder={type === "Tool" ? "e.g. Figma" : "e.g. Server Hosting"}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Billing Interval</span>
            <select
              name="billing_type"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            >
              <option value="Fixed_Monthly">Fixed Monthly</option>
              <option value="Annual">Annual</option>
              <option value="Per_Project_Pass_Through">Per Project / Pass Through</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Cost ($)</span>
            <input
              name="cost_amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Access Link (Optional)</span>
            <input
              name="access_link"
              type="url"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-[#00FF00]/50 focus:outline-none"
              placeholder="https://..."
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-lg bg-zinc-50 px-4 py-2 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Add Resource"}
        </button>
      </form>
    </div>
  );
}

export function DeleteResourceButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove this resource?")) return;
    setPending(true);
    await deleteResource(id);
    setPending(false);
  };

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-xs font-semibold text-rose-500 hover:text-rose-400 disabled:opacity-50"
      title="Delete Resource"
    >
      {pending ? "..." : "Remove"}
    </button>
  );
}
