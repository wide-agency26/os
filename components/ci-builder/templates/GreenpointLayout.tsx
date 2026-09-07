"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { CIAsset, CISection, CiLogoMark } from "@/lib/ci-builder/types";
import type { GuidelineViewModel, TypeRoleResolved } from "@/lib/ci-builder/view-model";
import { CiFontLoader } from "@/components/ci-builder/CiFontLoader";
import { asTextItems } from "@/lib/ci-builder/canvas/lists";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import {
  hexToRgb,
  hexToCmykToken,
  toHexColor,
  pickTextColor,
  isCompleteHex,
} from "@/lib/ci-builder/color-utils";
import {
  groupSwatchesByFamily,
  pickHero,
  familyLabelFromSwatch,
} from "@/lib/ci-builder/color-families";
import type { ColorSwatch } from "@/lib/ci-builder/types";
import { clientViewStyle } from "@/components/ci-builder/canvas/view/ViewContent";
import "@/components/ci-builder/canvas/CiCanvas.css";
import "@/components/ci-builder/templates/greenpoint-brandpad.css";

function assetSrc(assets: Partial<CIAsset>[], id?: string | null): string {
  if (!id) return "";
  const a = assets.find((x) => x.id === id);
  if (!a) return "";
  const pub = String(a.public_url || "").trim();
  if (pub) return pub;
  const meta = (a.metadata || {}) as { pending_export?: boolean };
  if (meta.pending_export) return "";
  const path = String(a.storage_path || "").trim();
  if (!path || path.startsWith("figma://") || path.startsWith("pending/")) return "";
  return path;
}

function findSec(vm: GuidelineViewModel, type: string): Partial<CISection> | undefined {
  return (
    vm.sections.find((s) => s.section_type === type) ||
    vm.modules.flatMap((m) => m.sections).find((s) => s.section_type === type)
  );
}

function allOf(vm: GuidelineViewModel, pred: (s: Partial<CISection>) => boolean) {
  return vm.modules.flatMap((m) => m.sections).filter(pred);
}

function markUrl(assets: Partial<CIAsset>[], mark: CiLogoMark | null | undefined, dark: boolean): string {
  if (!mark) return "";
  return assetSrc(assets, dark ? mark.darkAssetId || mark.lightAssetId : mark.lightAssetId || mark.darkAssetId);
}

type NavId = "Home" | "Voice" | "Logos" | "Colors" | "Fonts" | "Photography" | "Examples" | "Contact";

type StoryBlock =
  | { kind: "logo"; url: string }
  | { kind: "headline"; text: string }
  | { kind: "photo"; url: string; caption?: string }
  | { kind: "body"; text: string; highlight?: string }
  | { kind: "labeled"; title: string; items: string[] }
  | { kind: "editorial"; dos: string[]; donts: string[] };

function mapHomeStory(vm: GuidelineViewModel): {
  story: StoryBlock[];
  leftoverPhotos: { url: string; caption: string }[];
} {
  const blocks: StoryBlock[] = [];
  const mainLight = markUrl(vm.assets, vm.mainLogo, false);
  if (mainLight) blocks.push({ kind: "logo", url: mainLight });

  const claim = findSec(vm, "claim_pitch");
  const claimText = String((claim?.data as any)?.claim || "").trim();
  const pitchText = String((claim?.data as any)?.pitch || "").trim();
  const cover = String(vm.theme.coverTitle || "").trim();
  const headline =
    claimText || cover || (vm.brandName ? `The visual identity of ${vm.brandName}.` : "");
  if (headline) blocks.push({ kind: "headline", text: headline });

  const photoItems = (((findSec(vm, "brand_photography")?.data as any)?.items || []) as {
    assetId?: string;
    caption?: string;
  }[])
    .map((i) => ({ url: assetSrc(vm.assets, i.assetId), caption: String(i.caption || "").trim() }))
    .filter((p) => p.url);

  const mission = String((findSec(vm, "mission")?.data as any)?.body || "").trim();
  const vision = String((findSec(vm, "vision")?.data as any)?.body || "").trim();
  const texts: string[] = [];
  if (mission) texts.push(mission);
  if (pitchText && pitchText !== claimText) texts.push(pitchText);
  if (vision) texts.push(vision);

  let usedPhotos = 0;
  const maxStoryPhotos = Math.min(2, photoItems.length);
  const textQueue = [...texts];
  while (usedPhotos < maxStoryPhotos || textQueue.length > 0) {
    if (usedPhotos < maxStoryPhotos) {
      const p = photoItems[usedPhotos];
      blocks.push({ kind: "photo", url: p.url, caption: p.caption });
      usedPhotos += 1;
    }
    if (textQueue.length) {
      const t = textQueue.shift()!;
      blocks.push({
        kind: "body",
        text: t,
        highlight:
          claimText && t.toLowerCase().includes(claimText.toLowerCase()) ? claimText : undefined,
      });
    } else if (usedPhotos >= maxStoryPhotos) {
      break;
    }
  }

  const values = asTextItems((findSec(vm, "core_values")?.data as any)?.items)
    .map((v) => v.text)
    .filter(Boolean);
  if (values.length) blocks.push({ kind: "labeled", title: "Core Values", items: values });

  const arch = findSec(vm, "brand_personality");
  const archetype = String((arch?.data as any)?.archetype || "").trim();
  const traits = asTextItems((arch?.data as any)?.traits)
    .map((t) => t.text)
    .filter(Boolean);
  if (archetype || traits.length) {
    blocks.push({
      kind: "labeled",
      title: "Brand Archetype",
      items: [archetype, ...traits].filter(Boolean),
    });
  }

  const dos = asTextItems((findSec(vm, "editorial_guidelines")?.data as any)?.dos)
    .map((d) => d.text)
    .filter(Boolean);
  const donts = asTextItems((findSec(vm, "editorial_guidelines")?.data as any)?.donts)
    .map((d) => d.text)
    .filter(Boolean);
  if (dos.length || donts.length) blocks.push({ kind: "editorial", dos, donts });

  return { story: blocks, leftoverPhotos: photoItems.slice(usedPhotos) };
}

function highlightBody(text: string, highlight?: string): React.ReactNode {
  if (!highlight || !text.includes(highlight)) return text;
  const parts = text.split(highlight);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <span className="gp-bp-accent-phrase">{highlight}</span> : null}
    </React.Fragment>
  ));
}

function FontSpecimen({ role, label }: { role?: TypeRoleResolved; label: string }) {
  if (!role) return null;
  return (
    <div className="gp-bp-font-card">
      <span className="gp-bp-font-label">{label}</span>
      <div
        className="gp-bp-font-specimen"
        style={{
          fontFamily: role.fontFamily,
          fontWeight: role.fontWeight as React.CSSProperties["fontWeight"],
          fontStyle: role.fontStyle as React.CSSProperties["fontStyle"],
        }}
      >
        AaBbCc
      </div>
      <div
        className="gp-bp-body"
        style={{
          fontFamily: role.fontFamily,
          fontWeight: role.fontWeight as React.CSSProperties["fontWeight"],
          fontStyle: role.fontStyle as React.CSSProperties["fontStyle"],
          fontSize: "clamp(1rem, 1.6vw, 1.35rem)",
        }}
      >
        The quick brown fox jumps over the lazy dog.
      </div>
      <span className="gp-bp-font-meta">
        {role.fontFamily}
        {role.fontWeight ? ` · ${role.fontWeight}` : ""}
        {role.fontSize ? ` · ${role.fontSize}` : ""}
      </span>
    </div>
  );
}

function LinkPills({ links }: { links: { id: string; label: string; url: string }[] }) {
  if (!links.length) return null;
  return (
    <div className="gp-bp-downloads">
      {links.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="gp-bp-download-pill">
          {l.label || l.url}
        </a>
      ))}
    </div>
  );
}

export function GreenpointLayout({
  viewModel,
  toolbar,
}: {
  viewModel: GuidelineViewModel;
  viewMode?: string;
  mode?: "portal" | "standalone";
  slug?: string;
  initialModuleId?: string | null;
  toolbar?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<NavId>("Home");

  const accentRaw = viewModel.brandColorVars["--brand-accent-primary"] || "#FFDF51";
  const accent = isCompleteHex(accentRaw) ? toHexColor(accentRaw) : "#FFDF51";
  const onAccent = pickTextColor(accent);
  const cssVars = useMemo(
    () =>
      ({
        ...clientViewStyle(viewModel, "#ffffff"),
        "--gp-on-accent": onAccent,
        "--type-heading-primary-family": viewModel.typeCssVars["--tf-heading-primary"] || "inherit",
        "--type-heading-primary-weight": viewModel.typeCssVars["--tw-heading-primary"] || "600",
        "--type-heading-secondary-family":
          viewModel.typeCssVars["--tf-heading-secondary"] ||
          viewModel.typeCssVars["--tf-heading-primary"] ||
          "inherit",
        "--type-copy-body-family": viewModel.typeCssVars["--tf-copy-body"] || "inherit",
        "--type-copy-body-weight": viewModel.typeCssVars["--tw-copy-body"] || "400",
        "--type-copy-caption-family":
          viewModel.typeCssVars["--tf-copy-caption"] || viewModel.typeCssVars["--tf-copy-body"] || "inherit",
      }) as React.CSSProperties,
    [viewModel, onAccent]
  );

  const { story, leftoverPhotos } = useMemo(() => mapHomeStory(viewModel), [viewModel]);

  const logoStages = useMemo(() => {
    const stages: Array<{ id: string; label: string; url: string; dark: boolean }> = [];
    for (const mark of viewModel.logoMarks) {
      const light = markUrl(viewModel.assets, mark, false);
      const dark = markUrl(viewModel.assets, mark, true);
      const label = mark.name || (mark.isMain ? "Primary" : "Mark");
      if (light) stages.push({ id: `${mark.id}-light`, label: `${label} · light`, url: light, dark: false });
      if (dark) stages.push({ id: `${mark.id}-dark`, label: `${label} · dark`, url: dark, dark: true });
    }
    return stages;
  }, [viewModel]);

  const clearSpaceUrl = assetSrc(
    viewModel.assets,
    (findSec(viewModel, "clear_space")?.data as any)?.assetId
  );
  const misuse = Array.isArray((findSec(viewModel, "misuse_examples")?.data as any)?.items)
    ? (((findSec(viewModel, "misuse_examples")?.data as any).items || []) as {
        id: string;
        type?: string;
        assetId?: string;
        caption?: string;
      }[])
    : [];
  const logoLinks = ((findSec(viewModel, "logo_download_links")?.data as any)?.links || []) as {
    id: string;
    label: string;
    url: string;
  }[];
  const typeLinks = ((findSec(viewModel, "type_download_links")?.data as any)?.links || []) as {
    id: string;
    label: string;
    url: string;
  }[];

  const colors = useMemo(() => {
    const families = allOf(
      viewModel,
      (s) =>
        getSubModule(s.section_type || "")?.renderer === "color_group" &&
        s.section_type !== "functional"
    );
    const out: Array<{ id: string; name: string; hex: string; rgb: string; cmyk: string }> = [];
    for (const s of families) {
      const d = (s.data || {}) as {
        hex?: string;
        name?: string;
        cmyk?: string;
        swatches?: ColorSwatch[];
      };
      const swatches = d.swatches || [];
      if (d.hex || swatches.length) {
        const groups = swatches.length ? groupSwatchesByFamily(swatches) : [];
        if (groups.length) {
          for (const g of groups) {
            const hero = g.hero || pickHero(g.swatches);
            if (!hero?.hex) continue;
            const hex = toHexColor(hero.hex);
            const rgb = hexToRgb(hex);
            out.push({
              id: `${s.id}-${g.key}`,
              name: g.label || familyLabelFromSwatch(hero) || String(d.name || s.headline || "Color"),
              hex,
              rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
              cmyk: String(d.cmyk || hexToCmykToken(hex)),
            });
          }
          continue;
        }
        const heroHex = d.hex || pickHero(swatches)?.hex || swatches[0]?.hex;
        if (!heroHex) continue;
        const hex = toHexColor(heroHex);
        const rgb = hexToRgb(hex);
        out.push({
          id: String(s.id || hex),
          name: String(d.name || s.headline || "Color"),
          hex,
          rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
          cmyk: String(d.cmyk || hexToCmykToken(hex)),
        });
      }
    }
    if (!out.length) {
      return viewModel.proportionBars.map((b) => {
        const hex = toHexColor(b.hex);
        const rgb = hexToRgb(hex);
        return {
          id: b.id,
          name: b.name,
          hex,
          rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
          cmyk: hexToCmykToken(hex),
        };
      });
    }
    return out;
  }, [viewModel]);

  const primaryType = viewModel.typeRoles["heading-primary"];
  const secondaryType = viewModel.typeRoles["copy-body"] || viewModel.typeRoles["heading-secondary"];
  const typeScale = (((findSec(viewModel, "typography_scale")?.data as any)?.scale || []) as any[]).filter(
    (r) => r.fontFamily || r.role
  );

  const approved = asTextItems((findSec(viewModel, "copywriting_examples")?.data as any)?.approved)
    .map((a) => a.text)
    .filter(Boolean);
  const forbidden = asTextItems((findSec(viewModel, "copywriting_examples")?.data as any)?.forbidden)
    .map((a) => a.text)
    .filter(Boolean);
  const toneAxes = Array.isArray((findSec(viewModel, "tone_matrix")?.data as any)?.axes)
    ? ((findSec(viewModel, "tone_matrix")?.data as any).axes as { id?: string; left?: string; right?: string; value?: number }[])
    : [];
  const aiPrompt = String((findSec(viewModel, "ai_system_prompt")?.data as any)?.prompt || "").trim();

  const hasContact = Boolean(viewModel.teamName || viewModel.pointOfContact || viewModel.contactEmail);
  const hasFonts = Boolean(primaryType || secondaryType || typeScale.length);
  const hasLogos = logoStages.length > 0 || Boolean(clearSpaceUrl) || misuse.length > 0;
  const hasColors = colors.length > 0;
  const hasExamples = approved.length > 0;
  const hasPhotography = leftoverPhotos.length > 0;
  const hasVoice = toneAxes.length > 0 || approved.length > 0 || forbidden.length > 0 || Boolean(aiPrompt);
  const hasHome = story.length > 0;

  const nav: Array<{ id: NavId; label: string }> = [
    ...(hasHome ? [{ id: "Home" as const, label: "Home" }] : []),
    ...(hasVoice ? [{ id: "Voice" as const, label: "Voice" }] : []),
    ...(hasLogos ? [{ id: "Logos" as const, label: "Logos" }] : []),
    ...(hasColors ? [{ id: "Colors" as const, label: "Colors" }] : []),
    ...(hasFonts ? [{ id: "Fonts" as const, label: "Fonts" }] : []),
    ...(hasPhotography ? [{ id: "Photography" as const, label: "Photography" }] : []),
    ...(hasExamples ? [{ id: "Examples" as const, label: "Examples" }] : []),
    ...(hasContact ? [{ id: "Contact" as const, label: "Contact" }] : []),
  ];

  useEffect(() => {
    const ids = nav.map((n) => n.id);
    const nodes = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = hit?.target?.id as NavId | undefined;
        if (id && ids.includes(id)) setActive(id);
      },
      { threshold: 0.25, rootMargin: "-10% 0px -40% 0px" }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHome, hasVoice, hasLogos, hasColors, hasFonts, hasPhotography, hasExamples, hasContact]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const scrollTo = (id: NavId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
    setActive(id);
  };

  return (
    <div
      className={`ci-canvas ci-view-root gp-brandpad${menuOpen ? " gp-menu-open" : ""}`}
      style={cssVars}
      data-template="greenpoint"
    >
      <CiFontLoader theme={viewModel.theme} assets={viewModel.assets} sections={viewModel.sections} />

      <div className="gp-bp-guide">
        {nav.length ? (
          <div className="gp-bp-nav-chrome">
            <button
              type="button"
              className="gp-bp-menu-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 128 128" aria-hidden>
                  <path
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="square"
                    d="M7 7l114 114m0-114l-114 114"
                    fill="none"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 8 8" aria-hidden fill="currentColor">
                  <path d="M0 0v1h8V0H0zm0 2.97v1h8v-1H0zm0 3v1h8v-1H0z" transform="translate(0 1)" />
                </svg>
              )}
            </button>
            {menuOpen ? (
              <button
                type="button"
                className="gp-bp-menu-backdrop"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
            ) : null}
            <nav className="gp-bp-menu" aria-label="Brand sections">
              {nav.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={active === item.id ? "is-active" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(item.id);
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        ) : null}

        {toolbar ? <div className="gp-bp-toolbar-slot">{toolbar}</div> : null}

        {hasHome ? (
          <section id="Home" aria-label="Home">
            {story.map((block, i) => {
              if (block.kind === "logo") {
                return (
                  <div key={i} className="gp-bp-block gp-bp-pad-flush">
                    <div
                      className="gp-bp-logo-stage gp-on-white"
                      style={{ backgroundImage: `url(${block.url})` }}
                      role="img"
                      aria-label={`${viewModel.brandName} logo`}
                    />
                  </div>
                );
              }
              if (block.kind === "headline") {
                return (
                  <div key={i} className="gp-bp-block gp-bp-pad-md gp-bp-accent-band">
                    <h2 className="gp-bp-h2">{block.text}</h2>
                  </div>
                );
              }
              if (block.kind === "photo") {
                return (
                  <div key={i} className="gp-bp-block gp-bp-pad-flush">
                    <div
                      className="gp-bp-photo"
                      style={{ backgroundImage: `url(${block.url})` }}
                      role="img"
                      aria-label={block.caption || "Brand photography"}
                    />
                    {block.caption ? <p className="gp-bp-caption gp-bp-pad-sm">{block.caption}</p> : null}
                  </div>
                );
              }
              if (block.kind === "body") {
                return (
                  <div key={i} className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                    <p className="gp-bp-body">{highlightBody(block.text, block.highlight)}</p>
                  </div>
                );
              }
              if (block.kind === "labeled") {
                return (
                  <div key={i} className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                    <p className="gp-bp-section-kicker">{block.title}</p>
                    <ul className="gp-bp-list">
                      {block.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (block.kind === "editorial") {
                return (
                  <div key={i} className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                    <p className="gp-bp-section-kicker">Editorial guidelines</p>
                    <div className="gp-bp-editorial">
                      <div>
                        <span className="gp-bp-do">Do</span>
                        <ul className="gp-bp-list">
                          {block.dos.map((d, j) => (
                            <li key={j}>{d}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="gp-bp-dont">Don&apos;t</span>
                        <ul className="gp-bp-list">
                          {block.donts.map((d, j) => (
                            <li key={j}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </section>
        ) : null}

        {hasVoice ? (
          <section id="Voice" aria-label="Brand Voice">
            <div className="gp-bp-block gp-bp-pad-sm" style={{ background: "#fff" }}>
              <h2 className="gp-bp-section-title">Voice</h2>
            </div>
            {toneAxes.length ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-section-kicker">Tone of voice</p>
                <ul className="gp-bp-list">
                  {toneAxes.map((a, i) => (
                    <li key={a.id || i}>
                      {a.left || "—"} ↔ {a.right || "—"}
                      {typeof a.value === "number" ? ` · ${a.value}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {approved.length ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-section-kicker">Approved copy</p>
                {approved.map((q, i) => (
                  <p key={i} className="gp-bp-quote">
                    &ldquo;{q}&rdquo;
                  </p>
                ))}
              </div>
            ) : null}
            {forbidden.length ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-section-kicker">Avoid</p>
                <ul className="gp-bp-list">
                  {forbidden.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiPrompt ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#111", color: "#fff" }}>
                <p className="gp-bp-section-kicker" style={{ opacity: 0.7 }}>
                  AI system prompt
                </p>
                <pre className="gp-bp-code">{aiPrompt}</pre>
              </div>
            ) : null}
          </section>
        ) : null}

        {hasLogos ? (
          <section id="Logos" aria-label="Logos">
            <div className="gp-bp-block gp-bp-pad-sm" style={{ background: "#fff" }}>
              <h2 className="gp-bp-section-title">Logos</h2>
              <LinkPills links={logoLinks.filter((l) => l.url)} />
            </div>
            {logoStages.map((stage) => (
              <div key={stage.id} className="gp-bp-block gp-bp-pad-flush">
                <div
                  className={`gp-bp-logo-stage ${stage.dark ? "gp-on-black" : "gp-on-white"}`}
                  style={{ backgroundImage: `url(${stage.url})` }}
                  role="img"
                  aria-label={stage.label}
                />
                <p className={`gp-bp-caption gp-bp-pad-sm${stage.dark ? " gp-on-void-caption" : ""}`}>
                  {stage.label}
                </p>
              </div>
            ))}
            {clearSpaceUrl ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-section-kicker">Clear space</p>
                <div
                  className="gp-bp-clear-space"
                  style={{ backgroundImage: `url(${clearSpaceUrl})` }}
                  role="img"
                  aria-label="Clear space"
                />
              </div>
            ) : null}
            {misuse.length ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-section-kicker">Do &amp; Don&apos;t</p>
                <div className="gp-bp-misuse-grid">
                  {misuse.map((m) => {
                    const url = assetSrc(viewModel.assets, m.assetId);
                    return (
                      <div key={m.id} className="gp-bp-misuse-card">
                        <div
                          className="gp-bp-misuse-thumb"
                          style={url ? { backgroundImage: `url(${url})` } : undefined}
                        />
                        <span className={m.type === "do" ? "gp-bp-do" : "gp-bp-dont"}>
                          {m.type === "do" ? "Do" : "Don't"}
                        </span>
                        <p>{m.caption}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {hasColors ? (
          <section id="Colors" aria-label="Colours">
            <div className="gp-bp-block gp-bp-pad-sm" style={{ background: "#fff" }}>
              <h2 className="gp-bp-section-title">Colours</h2>
            </div>
            <div className="gp-bp-swatches">
              {colors.map((c) => (
                <div key={c.id} className="gp-bp-swatch">
                  <div className="gp-bp-swatch-chip" style={{ background: c.hex }} />
                  <div className="gp-bp-swatch-meta">
                    <div className="gp-bp-swatch-name">{c.name}</div>
                    <div>Hex {c.hex}</div>
                    <div>{c.rgb}</div>
                    <div>CMYK {c.cmyk}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {hasFonts ? (
          <section id="Fonts" aria-label="Fonts">
            <div className="gp-bp-block gp-bp-pad-sm" style={{ background: "#fff" }}>
              <h2 className="gp-bp-section-title">Fonts</h2>
              <LinkPills links={typeLinks.filter((l) => l.url)} />
            </div>
            <div className="gp-bp-font-pair">
              <FontSpecimen role={primaryType} label="Primary" />
              <FontSpecimen role={secondaryType} label="Secondary" />
            </div>
            {typeScale.length ? (
              <div className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-section-kicker">Type scale</p>
                <div className="gp-bp-type-scale">
                  {typeScale.map((row) => (
                    <div key={row.id || row.name}>
                      <div
                        style={{
                          fontFamily: row.fontFamily,
                          fontWeight: row.fontWeight,
                          fontStyle: row.fontStyle,
                          fontSize: row.value || (row.px ? `${row.px}px` : 28),
                          lineHeight: row.lineHeight,
                          letterSpacing: row.letterSpacing,
                        }}
                      >
                        {row.name || row.token || "Aa"}
                      </div>
                      <span className="gp-bp-font-meta">
                        {row.role || row.token || "—"} · {row.fontFamily} · {row.value || `${row.px}px`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {hasPhotography ? (
          <section id="Photography" aria-label="Photography">
            <div className="gp-bp-block gp-bp-pad-sm" style={{ background: "#fff" }}>
              <h2 className="gp-bp-section-title">Photography</h2>
            </div>
            {leftoverPhotos.map((p, i) => (
              <div key={`photo-${i}`} className="gp-bp-block gp-bp-pad-flush">
                <div
                  className="gp-bp-photo"
                  style={{ backgroundImage: `url(${p.url})` }}
                  role="img"
                  aria-label={p.caption || "Brand photography"}
                />
                {p.caption ? <p className="gp-bp-caption gp-bp-pad-sm">{p.caption}</p> : null}
              </div>
            ))}
          </section>
        ) : null}

        {hasExamples ? (
          <section id="Examples" aria-label="Copy examples">
            <div className="gp-bp-block gp-bp-pad-sm" style={{ background: "#fff" }}>
              <h2 className="gp-bp-section-title">Examples</h2>
              <p className="gp-bp-caption">Approved brand voice copy</p>
            </div>
            {approved.map((q, i) => (
              <div key={`ex-q-${i}`} className="gp-bp-block gp-bp-pad-md" style={{ background: "#fff" }}>
                <p className="gp-bp-quote">&ldquo;{q}&rdquo;</p>
              </div>
            ))}
          </section>
        ) : null}

        {hasContact ? (
          <section id="Contact" aria-label="Contact" className="gp-bp-dark-band">
            <div className="gp-bp-block gp-bp-pad-md">
              {viewModel.teamName ? <p className="gp-bp-contact-line">{viewModel.teamName}</p> : null}
              {viewModel.pointOfContact ? (
                <p className="gp-bp-contact-line">Point of contact: {viewModel.pointOfContact}</p>
              ) : null}
              {viewModel.contactEmail ? (
                <p className="gp-bp-contact-line">
                  <a href={`mailto:${viewModel.contactEmail}`}>{viewModel.contactEmail}</a>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
