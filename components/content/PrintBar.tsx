"use client";

export function PrintBar({ csvHref, filename }: { csvHref: string; filename: string }) {
  return (
    <div className="no-print mb-6 flex gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-[13px]"
      >
        Print / Save PDF
      </button>
      <a
        href={csvHref}
        download={filename}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-[13px]"
      >
        Download CSV
      </a>
    </div>
  );
}
