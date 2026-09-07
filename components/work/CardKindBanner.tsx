"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Minus, ArrowRight } from "lucide-react";

export type CardKind = "project" | "pipeline";

const COPY: Record<
  CardKind,
  {
    title: string;
    kicker: string;
    body: string;
    vs: string;
    siblingLabel: string;
  }
> = {
  project: {
    title: "Project card",
    kicker: "Delivery file",
    body: "This is the live job. Tasks, SOW, contract, content, blog, and reports for this client live here.",
    vs: "The pipeline card is the deal — qualify, propose, quote, contract.",
    siblingLabel: "Open pipeline card",
  },
  pipeline: {
    title: "Pipeline card",
    kicker: "Deal record",
    body: "This is the BD file. Qualify, propose, quote, and contract for this company live here.",
    vs: "The project card is delivery — tasks and live work after they sign.",
    siblingLabel: "Open project card",
  },
};

function storageKey(kind: CardKind) {
  return `wide.cardKindBanner.${kind}`;
}

export function CardKindBanner({
  kind,
  siblingHref,
}: {
  kind: CardKind;
  siblingHref?: string | null;
}) {
  const copy = COPY[kind];
  const [minimized, setMinimized] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey(kind)) === "1") setMinimized(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [kind]);

  function toggle() {
    setMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey(kind), next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!ready) return null;

  if (minimized) {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left ${
          kind === "project"
            ? "bg-accent text-white"
            : "bg-surface border border-border text-text-primary"
        }`}
        title="Expand what this card is"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] shrink-0">
          {copy.title}
        </span>
        <span
          className={`text-[12px] truncate ${
            kind === "project" ? "text-white/75" : "text-text-secondary"
          }`}
        >
          {copy.kicker} · {copy.body}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="ml-auto shrink-0 opacity-80"
        />
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg px-5 py-6 sm:px-7 sm:py-8 ${
        kind === "project"
          ? "bg-accent text-white"
          : "bg-surface border-2 border-text-primary text-text-primary"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-[11px] font-bold uppercase tracking-[0.18em] ${
            kind === "project" ? "text-white/70" : "text-text-muted"
          }`}
        >
          {copy.kicker}
        </p>
        <button
          type="button"
          onClick={toggle}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold shrink-0 ${
            kind === "project"
              ? "text-white/80 hover:bg-white/10 hover:text-white"
              : "text-text-muted hover:bg-surface-raised hover:text-text-primary"
          }`}
        >
          <Minus size={14} strokeWidth={1.75} />
          Minimize
        </button>
      </div>
      <h2 className="mt-2 text-[40px] sm:text-[56px] font-semibold tracking-tight leading-[0.95]">
        {copy.title}
      </h2>
      <p
        className={`mt-4 max-w-2xl text-[15px] sm:text-[17px] leading-snug ${
          kind === "project" ? "text-white/90" : "text-text-primary"
        }`}
      >
        {copy.body}
      </p>
      <p
        className={`mt-2 max-w-2xl text-[13px] sm:text-[14px] ${
          kind === "project" ? "text-white/65" : "text-text-secondary"
        }`}
      >
        {copy.vs}
      </p>
      {siblingHref ? (
        <Link
          href={siblingHref}
          className={`mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold ${
            kind === "project"
              ? "text-white hover:underline"
              : "text-text-primary hover:underline"
          }`}
        >
          {copy.siblingLabel}
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}
