import type { WideAccess } from "@/lib/wide-os/types";

export function ModuleScaffold({
  access,
  title,
  description,
  children,
}: {
  access: WideAccess;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-enter mx-auto max-w-6xl space-y-6">
      <header className="border-b border-zinc-800 pb-5">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
          {access.executive ? "Founder" : access.zone}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-400">{description}</p>
      </header>
      {children ?? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-sm text-zinc-500">
          No content configured for this view yet.
        </div>
      )}
    </div>
  );
}
