import Link from "next/link";

export function WorkspaceHeader({
  moduleLabel,
  entityLabel,
  backHref,
  backLabel = moduleLabel,
}: {
  moduleLabel: string;
  entityLabel: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      <Link href={backHref} className="text-zinc-400 transition-colors hover:text-[#00FF00]">
        {backLabel}
      </Link>
      <span className="text-zinc-600" aria-hidden>
        ➔
      </span>
      <span className="text-zinc-100">{entityLabel}</span>
    </header>
  );
}
