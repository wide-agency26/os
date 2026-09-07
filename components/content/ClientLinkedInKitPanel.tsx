"use client";

import { useState } from "react";
import { ChevronDown, Copy, Check, Download, ExternalLink } from "lucide-react";
import type { ContentSocialAssets } from "@/lib/content/types";
import { hasClientLinkedInKit, parseSocialAssets } from "@/lib/content/social-assets";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  if (!text.trim()) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-secondary hover:bg-surface-raised"
    >
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

export function ClientLinkedInKitPanel({
  socialAssets,
}: {
  socialAssets: ContentSocialAssets | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const assets = parseSocialAssets(socialAssets);
  if (!hasClientLinkedInKit(assets)) return null;

  const copy = assets.linkedin_employee_copy;
  const aboutBlocks = [
    { lang: "DE", text: copy.about_de.trim() },
    { lang: "EN", text: copy.about_en.trim() },
  ].filter((b) => b.text);
  const bulletBlocks = [
    {
      lang: "DE",
      bullets: copy.experience_bullets_de,
      joined: copy.experience_bullets_de.map((b) => `• ${b}`).join("\n"),
    },
    {
      lang: "EN",
      bullets: copy.experience_bullets_en,
      joined: copy.experience_bullets_en.map((b) => `• ${b}`).join("\n"),
    },
  ].filter((b) => b.bullets.length > 0);

  const coverCount = assets.company_covers.length + assets.employee_covers.length;

  return (
    <div className="mb-5 rounded-xl border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised/60 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
            LinkedIn kit
          </p>
          <p className="text-[13px] text-text-secondary mt-0.5 truncate">
            {open
              ? "Cover options and profile copy for company + employee pages."
              : coverCount > 0
                ? `${coverCount} cover${coverCount === 1 ? "" : "s"} · profile About / Experience copy`
                : "Profile About / Experience copy and covers"}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-border p-4 space-y-5">
          <ol className="text-[12px] text-text-secondary space-y-1 list-decimal list-inside">
            <li>Download a cover and set it on LinkedIn (company or personal).</li>
            <li>Paste About / Experience bullets into your profile.</li>
            <li>
              Follow and tag{" "}
              <a
                href={copy.company_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                the Sign2x company page
              </a>
              .
            </li>
          </ol>

          {assets.company_covers.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
                Company covers
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {assets.company_covers.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-2 space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.url}
                      alt={c.label}
                      className="w-full h-16 object-cover rounded-md"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] text-text-primary truncate">{c.label}</p>
                      <a
                        href={c.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:underline shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {assets.employee_covers.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted mb-2">
                Employee covers — pick one
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                {assets.employee_covers.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-2 space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.url}
                      alt={c.label}
                      className="w-full h-16 object-cover rounded-md"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] text-text-primary truncate">{c.label}</p>
                      <a
                        href={c.url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-text-secondary hover:underline shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {aboutBlocks.length || bulletBlocks.length ? (
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Profile copy
              </p>
              {aboutBlocks.map((b) => (
                <div
                  key={`about-${b.lang}`}
                  className="rounded-lg border border-border bg-surface-raised/40 px-3 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-text-primary">About ({b.lang})</p>
                    <CopyButton text={b.text} label={`Copy About ${b.lang}`} />
                  </div>
                  <p className="text-[13px] text-text-secondary whitespace-pre-wrap leading-relaxed">
                    {b.text}
                  </p>
                </div>
              ))}
              {bulletBlocks.map((b) => (
                <div
                  key={`exp-${b.lang}`}
                  className="rounded-lg border border-border bg-surface-raised/40 px-3 py-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-text-primary">
                      Experience bullets ({b.lang})
                    </p>
                    <CopyButton text={b.joined} label={`Copy bullets ${b.lang}`} />
                  </div>
                  <ul className="text-[13px] text-text-secondary space-y-1.5 list-disc list-inside">
                    {b.bullets.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <a
                href={copy.company_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline"
              >
                Open Sign2x on LinkedIn
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
