"use client";

import type { BrandGuidelineDocument } from "@/lib/brand-guideline/types";
import { useEffect, useId, useRef, useState } from "react";

const T = {
  light: "#F2F7F7",
  muted: "rgba(242,247,247,0.5)",
  border: "rgba(242,247,247,0.09)",
  dark: "#232323",
  darkPage: "#1a1a1a",
  navy: "#132333",
};

function BrandMark({
  width = 32,
  fill = T.light,
  label,
}: {
  width?: number;
  fill?: string;
  label: string;
}) {
  const uid = useId().replace(/:/g, "");
  const isGrad = fill === "gradient";
  const initial = label.trim().slice(0, 1).toUpperCase() || "B";
  return (
    <svg
      width={width}
      height={width}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {isGrad && (
        <defs>
          <linearGradient id={uid} x1="8" y1="4" x2="32" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#276AAD" />
            <stop offset="100%" stopColor="#84B7E4" />
          </linearGradient>
        </defs>
      )}
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill={isGrad ? `url(#${uid})` : fill}
        opacity={isGrad ? 1 : 0.15}
      />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fill={isGrad ? T.darkPage : fill}
        fontSize="16"
        fontWeight="900"
        fontFamily="inherit"
      >
        {initial}
      </text>
    </svg>
  );
}

function MarqueeStrip({ accent }: { accent: string }) {
  const items = ["Momentum", "Build", "Ship", "Launch", "Grow", "Connect"];
  const colors = ["#FF4200", accent, "#CDFF00", "#FF00CE", "#FFC100", "#FF4200"];
  const [off, setOff] = useState(0);
  useEffect(() => {
    let r = 0;
    const tick = () => {
      setOff((o) => (o - 0.45) % 820);
      r = requestAnimationFrame(tick);
    };
    r = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(r);
  }, []);
  const loop = [...items, ...items, ...items];
  return (
    <div
      className="h-[200px] overflow-hidden flex items-center"
      style={{ background: T.darkPage }}
    >
      <div
        className="flex gap-2.5 whitespace-nowrap will-change-transform"
        style={{ transform: `translateX(${off}px)` }}
      >
        {loop.map((it, i) => (
          <span
            key={`${it}-${i}`}
            className="inline-flex items-center shrink-0 rounded-full px-[18px] py-1.5 font-black italic text-lg uppercase tracking-tight"
            style={{ background: colors[i % colors.length], color: T.darkPage }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function DnaCanvas({
  kind,
  accent,
}: {
  kind: "glow" | "gradient" | "marquee" | "grid" | "plain";
  accent: string;
}) {
  if (kind === "marquee") return <MarqueeStrip accent={accent} />;
  if (kind === "glow")
    return (
      <div
        className="relative h-[200px] overflow-hidden flex items-center justify-center"
        style={{ background: T.dark }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(56,154,255,0.45) 0%, rgba(56,154,255,0.12) 40%, transparent 75%)",
          }}
        />
        <span
          className="relative font-bold text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(56,154,255,0.7)" }}
        >
          Accent glow
        </span>
      </div>
    );
  if (kind === "grid")
    return (
      <div
        className="relative h-[200px] overflow-hidden flex items-center justify-center"
        style={{
          background: T.dark,
          backgroundImage:
            "linear-gradient(rgba(242,247,247,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(242,247,247,0.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <span
          className="relative font-bold text-[10px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(242,247,247,0.4)" }}
        >
          Grid texture
        </span>
      </div>
    );
  if (kind === "gradient")
    return (
      <div className="relative h-[200px] overflow-hidden" style={{ background: T.dark }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(255,193,0,0.12) 40%, rgba(255,66,0,0.18) 65%, rgba(35,35,35,0.95) 100%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-1/2"
          style={{ background: "linear-gradient(180deg, transparent, #232323)" }}
        />
        <span
          className="absolute top-[35%] left-1/2 -translate-x-1/2 font-bold text-[10px] uppercase tracking-[0.12em] whitespace-nowrap"
          style={{ color: "rgba(255,193,0,0.6)" }}
        >
          Gradient wash
        </span>
      </div>
    );
  return (
    <div
      className="h-[200px] flex items-center justify-center font-bold text-[10px] uppercase tracking-[0.12em]"
      style={{ background: T.dark, color: T.muted }}
    >
      Brand element
    </div>
  );
}

export function BrandGuidelinePreview({
  doc,
  className = "",
}: {
  doc: BrandGuidelineDocument;
  className?: string;
}) {
  const hasContent =
    doc.nav.length > 0 ||
    doc.hero.titleLines.some((l) => l.trim()) ||
    doc.logos.marks.length > 0;

  if (!hasContent) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-border-subtle bg-surface p-10 text-center text-sm text-text-muted ${className}`}
      >
        Brand guidelines not published yet.
      </div>
    );
  }

  const accent = doc.accentColor;
  const [active, setActive] = useState(doc.nav[0]?.id ?? "hero");
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ids = doc.nav.map((n) => n.id);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.target.id) setActive(e.target.id);
        });
      },
      { threshold: 0.25 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(`bg-${id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [doc.nav]);

  function navTo(id: string) {
    setActive(id);
    const el = document.getElementById(`bg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const groups = [...new Set(doc.nav.map((i) => i.group))];

  return (
    <div
      className={`flex rounded-2xl overflow-hidden border border-[rgba(242,247,247,0.09)] ${className}`}
      style={{ background: T.darkPage, color: T.light, fontFamily: "var(--font-sans), Inter, system-ui, sans-serif" }}
    >
      <aside
        className="hidden md:flex flex-col w-[220px] shrink-0 border-r z-[5] overflow-y-auto max-h-[calc(100vh-8rem)] sticky top-0 self-start"
        style={{ background: T.dark, borderColor: T.border }}
      >
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2.5 mb-1.5">
            <BrandMark width={22} fill={T.light} label={doc.brandName} />
            <div className="font-black text-[11px] uppercase tracking-tight leading-tight">
              {doc.brandName}
            </div>
          </div>
          <div
            className="text-[10px] font-bold uppercase tracking-[0.1em] mt-1"
            style={{ color: T.muted }}
          >
            {doc.sidebarSubtitle}
          </div>
        </div>
        <nav className="py-2.5 flex-1">
          {groups.map((g) => (
            <div key={g}>
              <div
                className="px-6 pt-2.5 pb-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "rgba(242,247,247,0.22)" }}
              >
                {g}
              </div>
              {doc.nav
                .filter((i) => i.group === g)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navTo(item.id)}
                    className="flex items-center gap-2 w-full text-left py-1.5 px-6 text-xs font-semibold border-0 cursor-pointer transition-colors"
                    style={{
                      color: active === item.id ? accent : T.muted,
                      background:
                        active === item.id ? `color-mix(in srgb, ${accent} 12%, transparent)` : "transparent",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: active === item.id ? accent : item.dotColor,
                        opacity: active === item.id ? 1 : 0.45,
                      }}
                    />
                    {item.label}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        {doc.showVersionTag && (
          <div
            className="px-6 py-3.5 border-t text-[10px]"
            style={{ borderColor: T.border, color: "rgba(242,247,247,0.22)" }}
          >
            {doc.versionLabel}
          </div>
        )}
      </aside>

      <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto max-h-[calc(100vh-8rem)]">
        <section
          id="bg-hero"
          className="min-h-[70vh] relative overflow-hidden flex items-center"
          style={{ background: T.dark }}
        >
          <div
            className="absolute -right-24 -top-24 w-[600px] h-[600px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(56,154,255,0.18) 0%, transparent 70%)",
            }}
          />
          <div className="relative z-[2] px-8 lg:px-16 py-16 max-w-[900px]">
            <div
              className="inline-flex items-center px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.1em] mb-7"
              style={{
                background: `${accent}1a`,
                border: `1px solid ${accent}4d`,
                color: accent,
              }}
            >
              {doc.hero.badge}
            </div>
            <div className="font-black italic uppercase leading-[0.88] tracking-tight text-[clamp(2.5rem,6vw,5rem)] mb-2">
              {doc.hero.titleLines.map((line, i) => (
                <span key={i} className="block" style={{ color: doc.hero.accentLineIndex === i ? accent : T.light }}>
                  {line}
                </span>
              ))}
            </div>
            <p className="text-base max-w-[480px] mt-6 leading-relaxed" style={{ color: T.muted }}>
              {doc.hero.description}
            </p>
            <div
              className="text-xs font-bold uppercase tracking-[0.08em] mt-7"
              style={{ color: T.muted }}
            >
              {doc.hero.metaTags.join(" · ")}
            </div>
          </div>
        </section>

        <section id="bg-logos" className="px-8 lg:px-16 py-16 border-b" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.logos.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.logos.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.logos.description}
          </p>

          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3.5"
            style={{ color: T.muted }}
          >
            {doc.logos.marksLabel}
          </div>
          <div className="flex flex-wrap gap-3 mb-9">
            {doc.logos.marks.map((c, i) => (
              <div
                key={i}
                className="rounded-[14px] overflow-hidden border relative"
                style={{ borderColor: c.preferred ? `${accent}44` : T.border }}
              >
                {c.preferred && (
                  <div
                    className="absolute top-2 right-2 z-[2] rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]"
                    style={{ background: accent, color: T.darkPage }}
                  >
                    Preferred
                  </div>
                )}
                <div
                  className="w-[152px] h-[116px] flex items-center justify-center"
                  style={{ background: c.bg }}
                >
                  <BrandMark width={72} fill={c.fill} label={doc.brandName} />
                </div>
                <div className="px-3 py-2 border-t" style={{ borderColor: T.border, background: T.dark }}>
                  <div className="font-bold text-[10px] uppercase tracking-[0.05em]">{c.label}</div>
                  <div className="text-[9px] mt-0.5" style={{ color: T.muted }}>
                    {c.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3.5"
            style={{ color: T.muted }}
          >
            {doc.logos.wordmarksLabel}
          </div>
          <div className="flex flex-col gap-2.5">
            {doc.logos.wordmarks.map((w, i) => (
              <div key={i} className="rounded-[14px] overflow-hidden border" style={{ borderColor: T.border }}>
                <div
                  className="flex items-center gap-[18px] px-7 py-[18px]"
                  style={{ background: w.bg }}
                >
                  <BrandMark width={52} fill={w.mFill} label={doc.brandName} />
                  <div
                    className="w-px h-[50px]"
                    style={{
                      background:
                        w.text === "#232323" ? "rgba(35,35,35,0.15)" : "rgba(242,247,247,0.14)",
                    }}
                  />
                  <div>
                    <div
                      className="font-black text-[26px] uppercase tracking-tight leading-[0.93]"
                      style={{ color: w.text }}
                    >
                      {w.line1}
                    </div>
                    <div
                      className="font-bold text-[10px] uppercase tracking-[0.2em] mt-1.5"
                      style={{ color: w.sub }}
                    >
                      {w.line2}
                    </div>
                  </div>
                </div>
                <div
                  className="px-3 py-2 border-t flex justify-between items-center gap-4"
                  style={{ borderColor: T.border, background: T.dark }}
                >
                  <div className="font-bold text-[10px] uppercase tracking-[0.05em]">{w.label}</div>
                  <div className="text-[9px] shrink-0" style={{ color: T.muted }}>
                    {w.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="bg-dna" className="px-8 lg:px-16 py-16 border-b" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.visualDna.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.visualDna.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.visualDna.description}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {doc.visualDna.elements.map((el, i) => (
              <div
                key={i}
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: T.border, background: T.dark }}
              >
                <DnaCanvas kind={el.kind} accent={accent} />
                <div className="px-[18px] py-3.5">
                  <div className="font-bold text-xs uppercase tracking-[0.06em]">{el.name}</div>
                  <div className="text-[11px] mt-1 leading-snug" style={{ color: T.muted }}>
                    {el.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="bg-colors" className="px-8 lg:px-16 py-16 border-b" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.colors.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.colors.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.colors.description}
          </p>

          <div className="flex rounded-2xl overflow-hidden h-[68px] mb-9">
            {doc.colors.band.map(({ hex, name }) => (
              <Band key={hex + name} hex={hex} name={name} />
            ))}
          </div>

          <ColorGroup label="Neon accents" items={doc.colors.neons} />
          <ColorGroup label="Blue scale" items={doc.colors.blues} />
          <ColorGroup label="Neutrals" items={doc.colors.neutrals} />
        </section>

        <section id="bg-type" className="px-8 lg:px-16 py-16 border-b" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.typography.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.typography.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.typography.description}
          </p>
          <div className="rounded-[20px] px-6 lg:px-11 py-9" style={{ background: T.dark }}>
            {doc.typography.specimens.map((s, i) => (
              <div
                key={i}
                className={
                  i < doc.typography.specimens.length - 1
                    ? "mb-8 pb-8 border-b"
                    : ""
                }
                style={{ borderColor: T.border }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.08em] mb-3"
                  style={{ color: "rgba(242,247,247,0.28)" }}
                >
                  {s.label}
                </div>
                <TypeSpecimen specimen={s} accent={accent} />
              </div>
            ))}
          </div>
        </section>

        <section id="bg-bgs" className="px-8 lg:px-16 py-16 border-b" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.backgrounds.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.backgrounds.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.backgrounds.description}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {doc.backgrounds.slots.map((s, i) => (
              <div
                key={`${s.name}-${i}`}
                className="relative rounded-xl border aspect-video overflow-hidden flex items-end p-2.5"
                style={{ borderColor: T.border }}
              >
                {s.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-90"
                    />
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)",
                      }}
                    />
                  </>
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(145deg,#1a1a1a,#2a2a2a)" }}
                  />
                )}
                <span
                  className="relative z-[1] text-[9px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="bg-voice" className="px-8 lg:px-16 py-16 border-b" style={{ borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.voice.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.voice.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.voice.description}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {doc.voice.pillars.map((p) => (
              <div key={p.label} className="rounded-[14px] p-5 border" style={{ background: T.dark, borderColor: T.border }}>
                <div
                  className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2"
                  style={{ color: T.muted }}
                >
                  {p.label}
                </div>
                <div className="font-black italic text-[19px] uppercase tracking-tight leading-tight">
                  {p.phrase}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              className="rounded-[14px] p-5 border"
              style={{ background: "rgba(0,236,255,0.06)", borderColor: "rgba(0,236,255,0.2)" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: accent }}>
                ✓ Do
              </div>
              {doc.voice.dos.map((t) => (
                <div key={t} className="flex gap-2 mb-1.5 text-[13px] leading-snug" style={{ color: T.muted }}>
                  <span style={{ color: accent }}>—</span>
                  {t}
                </div>
              ))}
            </div>
            <div
              className="rounded-[14px] p-5 border"
              style={{ background: "rgba(255,66,0,0.06)", borderColor: "rgba(255,66,0,0.2)" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: "#FF4200" }}>
                ✗ Don&apos;t
              </div>
              {doc.voice.donts.map((t) => (
                <div key={t} className="flex gap-2 mb-1.5 text-[13px] leading-snug" style={{ color: T.muted }}>
                  <span style={{ color: "#FF4200" }}>—</span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="bg-usage" className="px-8 lg:px-16 py-16">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: accent }}>
            {doc.usage.eyebrow}
          </div>
          <h2 className="font-black italic uppercase text-[clamp(2rem,4vw,3rem)] tracking-tight leading-[0.92] mb-3.5">
            {doc.usage.title}
          </h2>
          <p className="text-[15px] max-w-[560px] mb-9 leading-relaxed" style={{ color: T.muted }}>
            {doc.usage.description}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {doc.usage.examples.map((ex) => (
              <UsageCard key={ex.title} ex={ex} accent={accent} brandName={doc.brandName} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function Band({ hex, name }: { hex: string; name: string }) {
  const [flex, setFlex] = useState(1);
  return (
    <div
      className="flex items-end px-2.5 py-1.5 transition-[flex] duration-200 cursor-default min-w-0"
      style={{ flex, background: hex }}
      onMouseEnter={() => setFlex(1.8)}
      onMouseLeave={() => setFlex(1)}
    >
      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-black/65">{name}</div>
        <div className="text-[9px] font-mono text-black/45">{hex}</div>
      </div>
    </div>
  );
}

function ColorGroup({
  label,
  items,
}: {
  label: string;
  items: { bg: string; name: string; hex: string; role: string }[];
}) {
  return (
    <div className="mb-7">
      <div
        className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3.5"
        style={{ color: "rgba(242,247,247,0.5)" }}
      >
        {label}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {items.map((c) => (
          <div key={c.hex + c.name} className="rounded-xl overflow-hidden border" style={{ borderColor: T.border }}>
            <div className="h-[68px]" style={{ background: c.bg }} />
            <div className="px-3 py-2.5" style={{ background: T.dark }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.05em]">{c.name}</div>
              <div className="text-[10px] font-mono mt-0.5" style={{ color: T.muted }}>
                {c.hex}
              </div>
              <div
                className="text-[9px] font-bold uppercase tracking-[0.06em] mt-1"
                style={{ color: "rgba(242,247,247,0.28)" }}
              >
                {c.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeSpecimen({
  specimen,
  accent,
}: {
  specimen: BrandGuidelineDocument["typography"]["specimens"][number];
  accent: string;
}) {
  const { sample, variant } = specimen;
  if (variant === "display-xl")
    return (
      <div className="font-black italic uppercase text-[clamp(2.5rem,6vw,4rem)] leading-[0.88] tracking-tight">
        {sample}
      </div>
    );
  if (variant === "display")
    return (
      <div className="font-black italic uppercase text-5xl leading-[0.9] tracking-tight">
        {sample}
      </div>
    );
  if (variant === "heading")
    return (
      <div className="font-black uppercase text-4xl leading-none tracking-tight">
        {sample}
      </div>
    );
  if (variant === "subheading")
    return (
      <div className="font-bold uppercase text-[22px] leading-tight tracking-tight">
        {sample}
      </div>
    );
  if (variant === "label")
    return (
      <div className="font-bold text-xs uppercase tracking-[0.1em]" style={{ color: accent }}>
        {sample}
      </div>
    );
  if (variant === "body")
    return (
      <div className="font-normal text-base leading-relaxed max-w-[560px]" style={{ color: T.muted }}>
        {sample}
      </div>
    );
  if (variant === "caption")
    return (
      <div className="font-normal text-xs leading-normal" style={{ color: "rgba(242,247,247,0.35)" }}>
        {sample}
      </div>
    );
  const pills = sample.split(",").map((s) => s.trim()).filter(Boolean);
  const colors = ["#FF4200", accent, "#CDFF00", "#FF00CE", "#FFC100"];
  return (
    <div className="flex flex-wrap gap-2.5">
      {(pills.length ? pills : ["Explore", "Join", "Apply"]).map((l, i) => (
        <span
          key={l}
          className="inline-flex items-center px-5 py-2 rounded-full font-black italic text-sm uppercase tracking-tight"
          style={{ background: colors[i % colors.length], color: T.darkPage }}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

function UsageCard({
  ex,
  accent,
  brandName,
}: {
  ex: BrandGuidelineDocument["usage"]["examples"][number];
  accent: string;
  brandName: string;
}) {
  const span = ex.layout === "hero" ? "lg:col-span-2" : "";
  if (ex.layout === "social")
    return (
      <div className={`rounded-2xl border overflow-hidden ${span}`} style={{ borderColor: T.border }}>
        <div
          className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] border-b"
          style={{ background: T.dark, borderColor: T.border, color: T.muted }}
        >
          {ex.title}
        </div>
        <div
          className="aspect-square relative flex items-center justify-center overflow-hidden"
          style={{ background: T.dark }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle at 80% 20%, rgba(56,154,255,0.2) 0%, transparent 60%)",
            }}
          />
          <div className="relative text-center px-7">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5"
              style={{ color: accent }}
            >
              {brandName}
            </div>
            <div className="font-black italic text-[clamp(1.5rem,4vw,2.5rem)] uppercase tracking-tight leading-[0.9]">
              {brandName}
            </div>
            <div
              className="mt-4 inline-flex items-center px-[18px] py-2 rounded-full font-black italic text-[13px] uppercase tracking-tight"
              style={{ background: "#FF4200", color: T.darkPage }}
            >
              CTA
            </div>
            <p className="text-[11px] mt-3" style={{ color: T.muted }}>
              {ex.caption}
            </p>
          </div>
        </div>
      </div>
    );
  if (ex.layout === "card")
    return (
      <div className={`rounded-2xl border overflow-hidden ${span}`} style={{ borderColor: T.border }}>
        <div
          className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] border-b"
          style={{ background: T.dark, borderColor: T.border, color: T.muted }}
        >
          {ex.title}
        </div>
        <div
          className="aspect-square relative flex items-center justify-center overflow-hidden"
          style={{ background: T.navy }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle at 70% 30%, rgba(255,66,0,0.15) 0%, transparent 55%)",
            }}
          />
          <div className="relative text-center px-6">
            <div
              className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center font-black italic text-2xl border-2"
              style={{ borderColor: "#389AFF", color: "#389AFF", background: "rgba(56,154,255,0.15)" }}
            >
              A
            </div>
            <div className="font-black text-[15px] uppercase tracking-tight">Speaker Name</div>
            <div className="text-[11px] mt-1" style={{ color: T.muted }}>
              Role · {brandName}
            </div>
            <p className="text-[11px] mt-3" style={{ color: T.muted }}>
              {ex.caption}
            </p>
          </div>
        </div>
      </div>
    );
  return (
    <div className={`rounded-2xl border overflow-hidden ${span}`} style={{ borderColor: T.border }}>
      <div
        className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] border-b"
        style={{ background: T.dark, borderColor: T.border, color: T.muted }}
      >
        {ex.title}
      </div>
      <div className="h-[220px] relative overflow-hidden flex items-center" style={{ background: T.dark }}>
        <div
          className="absolute -right-10 -top-5 w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,0,206,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="relative px-10 flex flex-wrap items-center gap-10 w-full">
          <div>
            <div
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em] mb-2.5 border"
              style={{
                background: `${accent}1f`,
                borderColor: `${accent}4d`,
                color: accent,
              }}
            >
              {brandName}
            </div>
            <div className="font-black italic text-[38px] uppercase tracking-tight leading-[0.9]">
              {brandName.split(" ").slice(0, 2).join(" ")}
              <br />
              <span style={{ color: accent }}>{brandName.split(" ").slice(2).join(" ") || "Launch"}</span>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[13px] leading-relaxed mb-3.5 max-w-[320px]" style={{ color: T.muted }}>
              Supporting line that reinforces the hero promise — keep it short and specific.
            </p>
            <div className="flex gap-2">
              <span
                className="inline-flex items-center px-[18px] py-2 rounded-full font-black italic text-[13px] uppercase"
                style={{ background: "#FF4200", color: T.darkPage }}
              >
                Primary
              </span>
              <span
                className="inline-flex items-center px-4 py-2 rounded-full font-bold text-xs uppercase border"
                style={{ borderColor: "rgba(242,247,247,0.25)", color: T.muted }}
              >
                Secondary
              </span>
            </div>
            <p className="text-[11px] mt-3" style={{ color: T.muted }}>
              {ex.caption}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
