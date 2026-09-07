"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg py-16">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        Server error
      </p>
      <h1 className="text-2xl font-semibold text-text-primary mt-1">
        This page couldn’t load
      </h1>
      <p className="text-[13px] text-text-secondary mt-2">
        The rest of OS is still up. Use Report in the corner so we keep the URL,
        tab, and this error id.
      </p>
      {error.digest ? (
        <p
          data-debug-digest={error.digest}
          className="text-[12px] font-mono text-text-muted mt-3"
        >
          ERROR {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex items-center min-h-11 rounded-lg bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent-hover"
      >
        Reload
      </button>
    </div>
  );
}
