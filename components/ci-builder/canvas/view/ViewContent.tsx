"use client";

import React, { useState } from "react";
import type { CIAsset, CISection, CiLogoMark } from "@/lib/ci-builder/types";
import type { GuidelineViewModel } from "@/lib/ci-builder/view-model";
import { asTextItems } from "@/lib/ci-builder/canvas/lists";
import { getSubModule } from "@/lib/ci-builder/modules-catalog";
import { hexToRgb, hexToCmykToken, toHexColor } from "@/lib/ci-builder/color-utils";
import { canvasKeyForModuleId, CANVAS_MODULES, type CanvasModuleKey } from "@/lib/ci-builder/canvas/modules";

function src(assets: Partial<CIAsset>[], id?: string | null) {
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

function sec(vm: GuidelineViewModel, type: string) {
  return vm.sections.find((s) => s.section_type === type) || vm.modules.flatMap((m) => m.sections).find((s) => s.section_type === type);
}

function allOf(vm: GuidelineViewModel, pred: (s: Partial<CISection>) => boolean) {
  return vm.modules.flatMap((m) => m.sections).filter(pred);
}

export function CopyPromptControl({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  if (!prompt) return null;
  return (
    <span
      style={{ fontSize: 14, cursor: "pointer", color: "var(--brand-text-link)" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(prompt);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = prompt;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied ✓" : "Copy prompt ⧉"}
    </span>
  );
}

export function ModuleViewBody({
  vm,
  moduleKey,
  variant,
}: {
  vm: GuidelineViewModel;
  moduleKey: CanvasModuleKey;
  variant: "greenpoint" | "foundry" | "multipage";
}) {
  if (moduleKey === "core") return <CoreView vm={vm} variant={variant} />;
  if (moduleKey === "voice") return <VoiceView vm={vm} variant={variant} />;
  if (moduleKey === "logo") return <LogoView vm={vm} />;
  if (moduleKey === "color") return <ColorView vm={vm} />;
  if (moduleKey === "type") return <TypeView vm={vm} />;
  if (moduleKey === "tokens") return <TokensView vm={vm} />;
  if (moduleKey === "ui") return <UiView vm={vm} />;
  if (moduleKey === "imagery") return <ImageryView vm={vm} />;
  return <TouchView vm={vm} />;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="view-section-head" style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span className="mono view-eyebrow" style={{ fontSize: 11, color: "var(--brand-text-link)", textTransform: "uppercase", letterSpacing: 1, flex: "none" }}>
        {children}
      </span>
      <div className="view-divider" style={{ flex: 1, height: 1, background: "var(--brand-border-subtle)" }} />
    </div>
  );
}

function CoreView({ vm, variant }: { vm: GuidelineViewModel; variant: string }) {
  const mission = sec(vm, "mission");
  const claim = sec(vm, "claim_pitch");
  const values = asTextItems((sec(vm, "core_values")?.data as any)?.items);
  const arch = sec(vm, "brand_personality");
  const photo = src(vm.assets, (arch?.data as any)?.assetId);
  const traits = asTextItems((arch?.data as any)?.traits);
  const dos = asTextItems((sec(vm, "editorial_guidelines")?.data as any)?.dos);
  const donts = asTextItems((sec(vm, "editorial_guidelines")?.data as any)?.donts);
  const numbered = variant === "multipage";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <Eyebrow>Mission & Positioning</Eyebrow>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", marginTop: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--brand-text-muted)", textTransform: "uppercase" }}>
              {String((mission?.data as any)?.label || "Mission")}
            </span>
            <div className="view-heading-secondary" style={{ fontSize: 28, marginTop: 8 }}>
              {String((mission?.data as any)?.body || "—")}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--brand-text-muted)", textTransform: "uppercase" }}>
              {String((claim?.data as any)?.claimLabel || "Claim / Pitch")}
            </span>
            <div style={{ fontSize: 16, color: "var(--brand-text-muted)", marginTop: 8 }}>
              {String((claim?.data as any)?.claim || (claim?.data as any)?.pitch || "—")}
            </div>
          </div>
        </div>
      </div>
      <div>
        <Eyebrow>Brand Archetype</Eyebrow>
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
          {photo ? (
            <div style={{ width: 120, height: 120, borderRadius: 12, background: `url(${photo}) center/cover`, flex: "none" }} />
          ) : null}
          <div>
            <div style={{ fontSize: 16, color: "var(--brand-text-muted)", lineHeight: 1.5 }}>
              {String((arch?.data as any)?.archetype || "—")}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {traits.map((t) => (
                <span key={t.id} style={{ fontSize: 13, background: "var(--brand-surface-card)", padding: "8px 16px", borderRadius: 20 }}>
                  {t.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div>
        <Eyebrow>Core Values</Eyebrow>
        <div style={{ display: numbered ? "flex" : "flex", flexDirection: numbered ? "column" : "row", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {values.map((v, i) =>
            numbered ? (
              <div key={v.id} style={{ fontSize: 16 }}>
                {i + 1}. {v.text}
              </div>
            ) : (
              <span key={v.id} style={{ fontSize: 13, background: "var(--brand-surface-card)", padding: "8px 16px", borderRadius: 20 }}>
                {v.text}
              </span>
            )
          )}
        </div>
      </div>
      <div>
        <Eyebrow>Editorial Do&apos;s / Don&apos;ts</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 16, borderRadius: 12, overflow: "hidden" }}>
          {dos.map((d) => (
            <div key={d.id} style={{ background: "var(--brand-surface-card)", padding: 24 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--brand-accent-success)", textTransform: "uppercase" }}>
                Do
              </span>
              <div style={{ fontSize: 15, marginTop: 8 }}>{d.text}</div>
            </div>
          ))}
          {donts.map((d) => (
            <div key={d.id} style={{ background: "var(--brand-surface-card)", padding: 24 }}>
              <span className="mono" style={{ fontSize: 11, color: "#e0715a", textTransform: "uppercase" }}>
                Don&apos;t
              </span>
              <div style={{ fontSize: 15, marginTop: 8 }}>{d.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoiceView({ vm, variant }: { vm: GuidelineViewModel; variant: string }) {
  const axes = Array.isArray((sec(vm, "tone_matrix")?.data as any)?.axes) ? (sec(vm, "tone_matrix")?.data as any).axes : [];
  const approved = asTextItems((sec(vm, "copywriting_examples")?.data as any)?.approved);
  const forbidden = asTextItems((sec(vm, "copywriting_examples")?.data as any)?.forbidden);
  const prompt = String((sec(vm, "ai_system_prompt")?.data as any)?.prompt || "");
  const dot = variant === "foundry" ? 12 : variant === "multipage" ? 8 : 16;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <Eyebrow>Tone Matrix</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 560, maxWidth: "100%", marginTop: 16 }}>
          {axes.map((a: any) => (
            <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{a.left}</span>
                <span>{a.right}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--brand-border-input)", position: "relative" }}>
                <div
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: "50%",
                    background: "var(--brand-accent-primary)",
                    position: "absolute",
                    left: `${Number(a.value ?? 50)}%`,
                    top: -(dot / 2 - 4),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Eyebrow>Voice Examples</Eyebrow>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
          {approved.map((x) => (
            <div key={x.id} style={{ flex: 1, minWidth: 220, background: "var(--brand-surface-card)", padding: 24, borderRadius: 12 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--brand-accent-success)" }}>ON</span>
              <div style={{ marginTop: 8 }}>&ldquo;{x.text}&rdquo;</div>
            </div>
          ))}
          {forbidden.map((x) => (
            <div key={x.id} style={{ flex: 1, minWidth: 220, background: "var(--brand-surface-card)", padding: 24, borderRadius: 12 }}>
              <span className="mono" style={{ fontSize: 11, color: "#e0715a" }}>OFF</span>
              <div style={{ marginTop: 8 }}>&ldquo;{x.text}&rdquo;</div>
            </div>
          ))}
        </div>
      </div>
      {prompt ? (
        <div>
          <Eyebrow>AI System Prompt</Eyebrow>
          <div style={{ marginTop: 16, padding: 24, borderRadius: 12, background: "var(--brand-surface-card)", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="mono" style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{prompt}</span>
            <CopyPromptControl prompt={prompt} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LogoView({ vm }: { vm: GuidelineViewModel }) {
  const marks = vm.logoMarks;
  const main = vm.mainLogo;
  const others = marks.filter((m) => m.id !== main?.id);
  const clear = sec(vm, "clear_space");
  const misuse = Array.isArray((sec(vm, "misuse_examples")?.data as any)?.items)
    ? (sec(vm, "misuse_examples")?.data as any).items
    : [];
  const links = ((sec(vm, "logo_download_links")?.data as any)?.links || []) as {
    id: string;
    label: string;
    url: string;
  }[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {main ? (
        <div>
          <Eyebrow>Primary (MAIN)</Eyebrow>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
            <LogoWell assets={vm.assets} mark={main} dark={false} label="On light" />
            <LogoWell assets={vm.assets} mark={main} dark label="On dark" />
          </div>
        </div>
      ) : null}
      {others.length ? (
        <div>
          <Eyebrow>Variations</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 16 }}>
            {others.map((m) => (
              <div key={m.id}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "var(--brand-text-primary)" }}>
                  {m.name || "Untitled mark"}
                </span>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
                  <LogoWell assets={vm.assets} mark={m} dark={false} label="On light" />
                  <LogoWell assets={vm.assets} mark={m} dark label="On dark" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {!main && !others.length ? (
        <span style={{ fontSize: 14, color: "var(--brand-text-muted)" }}>No logo marks yet.</span>
      ) : null}
      {src(vm.assets, (clear?.data as any)?.assetId) ? (
        <div>
          <Eyebrow>Clear Space</Eyebrow>
          <div
            style={{
              marginTop: 16,
              height: 200,
              background: `url(${src(vm.assets, (clear?.data as any)?.assetId)}) center/contain no-repeat`,
            }}
          />
        </div>
      ) : null}
      {misuse.length ? (
        <div>
          <Eyebrow>Do &amp; Don&apos;t</Eyebrow>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
            {misuse.map((i: any) => (
              <div key={i.id} style={{ flex: 1, minWidth: 200 }}>
                <div
                  style={{
                    height: 140,
                    background: i.assetId
                      ? `url(${src(vm.assets, i.assetId)}) center/contain no-repeat`
                      : "var(--brand-surface-card)",
                    borderRadius: 8,
                  }}
                />
                <span className="mono" style={{ fontSize: 11 }}>
                  {i.type === "do" ? "Do" : "Don't"}
                </span>
                <div>{i.caption}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {links.length ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {links.map((l) => (
            <a key={l.id} href={l.url} target="_blank" rel="noreferrer">
              {l.label || l.url}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LogoWell({
  assets,
  mark,
  dark,
  label,
}: {
  assets: Partial<CIAsset>[];
  mark: CiLogoMark;
  dark: boolean;
  label?: string;
}) {
  const url = src(assets, dark ? mark.darkAssetId : mark.lightAssetId);
  if (!url) return null;
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div
        style={{
          height: 180,
          borderRadius: 12,
          background: `${dark ? "#141414" : "#fff"} url(${url}) center/contain no-repeat`,
          padding: 40,
        }}
      />
      {label ? (
        <span className="mono" style={{ fontSize: 11, color: "var(--brand-text-muted)" }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}

function ColorView({ vm }: { vm: GuidelineViewModel }) {
  const families = allOf(vm, (s) => getSubModule(s.section_type || "")?.renderer === "color_group" && s.section_type !== "functional");
  const functional = ((sec(vm, "functional")?.data as any)?.swatches || []) as { id: string; name: string; hex: string }[];
  const bars = vm.proportionBars.length
    ? vm.proportionBars
    : families.slice(0, 3).map((s, i, arr) => {
        const hex = String((s.data as any)?.hex || (s.data as any)?.swatches?.[0]?.hex || "#ccc");
        return { id: s.id || String(i), name: String((s.data as any)?.name || s.headline), hex, proportion: 100 / arr.length };
      });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {bars.length ? (
        <div style={{ display: "flex", height: 28, borderRadius: 8, overflow: "hidden" }}>
          {bars.map((b) => (
            <div key={b.id} style={{ width: `${b.proportion}%`, background: b.hex }} />
          ))}
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {families.map((s) => {
          const d = (s.data || {}) as any;
          const hex = toHexColor(d.hex || d.swatches?.[0]?.hex || "#000");
          const rgb = hexToRgb(hex);
          return (
            <div key={s.id}>
              <div style={{ height: 100, borderRadius: 12, background: hex }} />
              <div style={{ marginTop: 8, fontWeight: 500 }}>{d.name || s.headline}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--brand-text-muted)" }}>
                {hex} · rgb({rgb.r}, {rgb.g}, {rgb.b}) · {d.cmyk || hexToCmykToken(hex)}
              </div>
            </div>
          );
        })}
      </div>
      {functional.length ? (
        <div style={{ display: "flex", gap: 8 }}>
          {functional.map((s) => (
            <div key={s.id} style={{ width: 64 }}>
              <div style={{ height: 32, borderRadius: 6, background: s.hex }} />
              <span style={{ fontSize: 11 }}>{s.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TypeView({ vm }: { vm: GuidelineViewModel }) {
  const scale = ((sec(vm, "typography_scale")?.data as any)?.scale || []) as any[];
  const primary = vm.primaryTypeface;
  const links = ((sec(vm, "type_download_links")?.data as any)?.links || []) as any[];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <Eyebrow>Primary Typeface</Eyebrow>
        <div className="view-heading-primary" style={{ fontSize: 40, marginTop: 12 }}>
          {primary.status === "set" ? primary.row.fontFamily : "not set"}
        </div>
      </div>
      {scale.map((row) => (
        <div key={row.id}>
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
          <span className="mono" style={{ fontSize: 11, color: "var(--brand-text-muted)" }}>
            {row.role || "no role"} · {row.value || `${row.px}px`}
          </span>
        </div>
      ))}
      {links.map((l: any) => (
        <a key={l.id} href={l.url}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

function TokensView({ vm }: { vm: GuidelineViewModel }) {
  const spacing = ((sec(vm, "spacing_system")?.data as any)?.tokens || []) as any[];
  const radius = ((sec(vm, "radius_system")?.data as any)?.tokens || []) as any[];
  const grid = (sec(vm, "layout_grids")?.data || {}) as { columns?: number; gutters?: number; margins?: number };
  const cols = Number(grid.columns) || 12;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <Eyebrow>Spacing</Eyebrow>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          {spacing.map((t) => (
            <div key={t.id}>
              <div style={{ width: parseInt(String(t.value), 10) || 16, height: 16, background: "var(--brand-accent-primary)" }} />
              <span className="mono" style={{ fontSize: 11 }}>{t.label} {t.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Eyebrow>Radius</Eyebrow>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          {radius.map((t) => (
            <div key={t.id}>
              <div style={{ width: 40, height: 40, background: "var(--brand-accent-primary)", borderRadius: t.value }} />
              <span className="mono" style={{ fontSize: 11 }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Eyebrow>Layout Grid</Eyebrow>
        <div style={{ display: "flex", gap: grid.gutters || 16, marginTop: 16, height: 80 }}>
          {Array.from({ length: Math.min(cols, 16) }).map((_, i) => (
            <div key={i} style={{ flex: 1, background: "var(--brand-surface-card)" }} />
          ))}
        </div>
        <span className="mono" style={{ fontSize: 11 }}>
          {cols} columns · {grid.gutters || 24}px gutter · {grid.margins || 32}px margin
        </span>
      </div>
    </div>
  );
}

function UiView({ vm }: { vm: GuidelineViewModel }) {
  const buttons = ((sec(vm, "ui_primary")?.data as any)?.variants || []) as any[];
  const forms = ((sec(vm, "form_controls")?.data as any)?.controls || []) as any[];
  const badges = ((sec(vm, "status_badges")?.data as any)?.badges || []) as any[];
  const empty = (sec(vm, "ui_empty_error")?.data || {}) as any;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {buttons.map((b) =>
          b.assetId ? (
            <img key={b.id} src={src(vm.assets, b.assetId)} alt={b.label} style={{ height: 40 }} />
          ) : (
            <button
              key={b.id}
              type="button"
              style={{
                background: b.bg || "var(--brand-accent-primary)",
                color: b.text || "#fff",
                borderRadius: b.radius || 8,
                padding: b.padding || "10px 18px",
                border: "none",
              }}
            >
              {b.label}
            </button>
          )
        )}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {forms.map((f) =>
          f.assetId ? (
            <img key={f.id} src={src(vm.assets, f.assetId)} alt={f.label} style={{ height: 40 }} />
          ) : (
            <input key={f.id} readOnly placeholder={f.label} style={{ padding: 10, borderRadius: 8, border: "1px solid var(--brand-border-input)" }} />
          )
        )}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {badges.map((b) => (
          <span key={b.id} style={{ padding: "6px 12px", borderRadius: 999, background: b.bg || b.hex, color: b.text || "#fff", fontSize: 12 }}>
            {b.label || b.name}
          </span>
        ))}
      </div>
      {(empty.emptyTitle || empty.errorTitle) ? (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {empty.emptyTitle ? (
            <div style={{ flex: 1, minWidth: 200, padding: 24, background: "var(--brand-surface-card)", borderRadius: 12 }}>
              <div style={{ fontWeight: 600 }}>{empty.emptyTitle}</div>
              <div style={{ fontSize: 14, color: "var(--brand-text-muted)" }}>{empty.emptyBody}</div>
            </div>
          ) : null}
          {empty.errorTitle ? (
            <div style={{ flex: 1, minWidth: 200, padding: 24, background: "var(--brand-surface-card)", borderRadius: 12 }}>
              <div style={{ fontWeight: 600 }}>{empty.errorTitle}</div>
              <div style={{ fontSize: 14, color: "var(--brand-text-muted)" }}>{empty.errorBody}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ImageryView({ vm }: { vm: GuidelineViewModel }) {
  const photos = ((sec(vm, "brand_photography")?.data as any)?.items || []) as any[];
  const tags = ((sec(vm, "brand_photography")?.data as any)?.tags || []) as string[];
  const styleItems = ((sec(vm, "photography_style")?.data as any)?.items || []) as any[];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {photos.filter((p) => src(vm.assets, p.assetId)).map((p) => (
          <div key={p.id}>
            <div style={{ height: 180, background: `url(${src(vm.assets, p.assetId)}) center/cover`, borderRadius: 8 }} />
            <span style={{ fontSize: 13 }}>{p.caption}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tags.map((t) => (
          <span key={t} style={{ padding: "6px 12px", borderRadius: 999, background: "var(--brand-surface-card)", fontSize: 12 }}>
            {t}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {styleItems.map((i) => (
          <div key={i.id} style={{ flex: 1, minWidth: 180 }}>
            <div style={{ height: 140, background: i.assetId ? `url(${src(vm.assets, i.assetId)}) center/cover` : "var(--brand-surface-card)", borderRadius: 8 }} />
            <span className="mono" style={{ fontSize: 11 }}>{i.type === "do" ? "Do" : "Don't"}</span>
            <div>{i.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TouchView({ vm }: { vm: GuidelineViewModel }) {
  const s4 = ((sec(vm, "social_4x5")?.data as any)?.items || []).concat(
    (sec(vm, "social_4x5")?.data as any)?.assetId
      ? [{ id: "s4", label: "4:5", assetId: (sec(vm, "social_4x5")?.data as any).assetId }]
      : []
  );
  const s9 = ((sec(vm, "social_9x16")?.data as any)?.items || []) as any[];
  const emails = ((sec(vm, "email_signatures")?.data as any)?.signatures || []) as any[];
  const decks = ((sec(vm, "presentation_deck")?.data as any)?.slides || []) as any[];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[...s4, ...s9].map((i: any) =>
          src(vm.assets, i.assetId) ? (
            <div key={i.id} style={{ width: 120, height: 160, background: `url(${src(vm.assets, i.assetId)}) center/cover`, borderRadius: 8 }} />
          ) : null
        )}
      </div>
      {emails.map((e) => (
        <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {e.assetId ? <div style={{ width: 48, height: 48, borderRadius: "50%", background: `url(${src(vm.assets, e.assetId)}) center/cover` }} /> : null}
          <div>
            <div>{e.name}</div>
            <div style={{ fontSize: 13, color: "var(--brand-text-muted)" }}>{e.title}</div>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {decks.map((s) =>
          s.assetId ? (
            <div key={s.id} style={{ width: 200, height: 112, background: `url(${src(vm.assets, s.assetId)}) center/cover`, borderRadius: 8 }} />
          ) : null
        )}
      </div>
    </div>
  );
}

export function clientViewStyle(
  vm: GuidelineViewModel,
  fallbackNeutral: string
): React.CSSProperties {
  const surface = vm.brandColorVars["--brand-neutral"] || fallbackNeutral;
  const accent = vm.brandColorVars["--brand-accent-primary"] || "#4c3e5e";
  return {
    "--brand-neutral": surface,
    "--brand-bg-canvas": vm.brandColorVars["--brand-bg-canvas"] || surface,
    "--brand-accent-primary": accent,
    ...vm.typeCssVars,
    ...vm.brandColorVars,
  } as React.CSSProperties;
}

export function firstPhotoUrl(vm: GuidelineViewModel): string {
  const items = ((sec(vm, "brand_photography")?.data as any)?.items || []) as { assetId?: string }[];
  for (const i of items) {
    const u = src(vm.assets, i.assetId);
    if (u) return u;
  }
  return "";
}

export function visibleCanvasModules(vm: GuidelineViewModel) {
  return CANVAS_MODULES.filter((m) => {
    const mod = vm.modules.find((x) => x.id === m.id);
    if (!mod || mod.hidden) return false;
    if (mod.sections.length > 0) return true;
    // Logo marks live on the view-model even when section rows were pruned.
    if (m.key === "logo" && vm.logoMarks.length > 0) return true;
    return false;
  });
}

export function moduleKeyFromId(id: string): CanvasModuleKey | null {
  return canvasKeyForModuleId(id);
}

export function ContactFooter({ vm, compact }: { vm: GuidelineViewModel; compact?: boolean }) {
  const contact = [vm.pointOfContact, vm.contactEmail].filter(Boolean).join(" — ");
  if (!contact && !vm.teamName) return null;
  if (compact) {
    return (
      <div style={{ marginTop: 48, fontSize: 13, color: "var(--brand-text-muted)" }}>
        {vm.teamName ? <div>{vm.teamName}</div> : null}
        {contact}
      </div>
    );
  }
  return (
    <div className="mp-footer">
      <div className="mp-footer-inner">
        <p className="mp-footer-intro">For any questions about using these guidelines, please contact:</p>
        {vm.teamName ? <span className="mp-footer-team">{vm.teamName}</span> : null}
        <div className="mp-footer-contact-block">
          <span className="mp-footer-label">Point of Contact</span>
          <span className="mp-footer-name">{vm.pointOfContact}</span>
          {vm.contactEmail ? (
            <a className="mp-footer-email" href={`mailto:${vm.contactEmail}`}>
              {vm.contactEmail}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
