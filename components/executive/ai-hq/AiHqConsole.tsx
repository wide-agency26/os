"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import { submitAiHqPrompt, approveAiHqJobAction, type AiHqState } from "@/app/actions/ai-hq";

const initial: AiHqState = {};

type Job = {
  id: string;
  prompt: string;
  is_draft: boolean;
  status: string;
  created_at: string;
};

export function AiHqConsole({ jobs }: { jobs: Job[] }) {
  const [state, action, pending] = useActionState(submitAiHqPrompt, initial);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">AI HQ</h1>
          <p className="mt-1 text-sm text-zinc-400">Natural-language operations console — drafts only until you approve.</p>
        </header>

        <ContextExplainer
          storageKey="admin-ai-hq"
          title="Execution isolation"
          description="Every command creates an ai_hq_jobs row with is_draft=true. Nothing touches a workspace until you click Approve on a queued draft."
        />

        <form action={action} className="mb-8 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-md">
          {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
          {state.success ? <p className="text-xs text-[#00FF00]">{state.success}</p> : null}
          <textarea
            name="prompt"
            rows={3}
            placeholder='e.g. "Generate Launch Kit task set for Acme Corp"'
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 resize-y"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#00FF00]/20 border border-[#00FF00]/50 px-4 py-2 text-sm font-medium text-[#00FF00] hover:bg-[#00FF00]/30 disabled:opacity-50"
          >
            {pending ? "Drafting…" : "Queue draft"}
          </button>
        </form>

        <ul className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-zinc-500">No drafts in queue.</p>
          ) : (
            jobs.map((job, i) => (
              <motion.li
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-zinc-200">{job.prompt}</p>
                  {job.is_draft ? (
                    <span className="shrink-0 rounded-full border border-[#00FF00]/50 bg-[#00FF00]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00FF00]">
                      Draft
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[10px] text-zinc-500">{new Date(job.created_at).toLocaleString()}</p>
                {job.is_draft && job.status === "queued" ? (
                  <form action={approveAiHqJobAction} className="mt-3">
                    <input type="hidden" name="job_id" value={job.id} />
                    <button
                      type="submit"
                      className="text-xs font-medium text-[#00FF00] hover:underline"
                    >
                      Approve action →
                    </button>
                  </form>
                ) : null}
              </motion.li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
