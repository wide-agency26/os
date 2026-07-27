export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm transition-colors hover:border-zinc-700">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
    </article>
  );
}
