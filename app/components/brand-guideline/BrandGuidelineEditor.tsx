"use client";

import { useState } from "react";
import type {
  BrandGuidelineDocument,
  GuidelineDnaElement,
  GuidelineTypeSpecimen,
  GuidelineUsageExample,
} from "@/lib/brand-guideline/types";
import { uploadBrandGuidelineBackgroundImage } from "@/app/actions/brand-guideline";
import { BRAND_STARTER_BLOCKS } from "@/lib/brand-guideline/ready-blocks";

const BRAND_SECTIONS = [
  { id: "brandShell", label: "Shell" },
  { id: "nav", label: "Nav" },
  { id: "hero", label: "Hero" },
  { id: "logos", label: "Logos" },
  { id: "visualDna", label: "Visual DNA" },
  { id: "colors", label: "Color" },
  { id: "typography", label: "Type" },
  { id: "backgrounds", label: "Backgrounds" },
  { id: "voice", label: "Voice" },
  { id: "usage", label: "Usage" },
] as const;

function Acc({
  id,
  title,
  complete,
  open,
  onToggle,
  headerRight,
  children,
}: {
  id: string;
  title: string;
  complete: boolean;
  open: boolean;
  onToggle: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={`acc-${id}`} className="scroll-mt-2 rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${complete ? "bg-accent" : "bg-border"}`}
            aria-hidden
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
            {title}
          </span>
          {complete ? (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-accent/80">done</span>
          ) : null}
        </button>
        {headerRight}
        <button
          type="button"
          onClick={onToggle}
          className="grid h-6 w-6 place-items-center rounded-md text-text-muted hover:bg-background"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? "−" : "+"}
        </button>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-border-subtle px-4 pb-4 pt-3">{children}</div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function inputClass(multiline?: boolean) {
  return [
    "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary",
    "placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40",
    multiline ? "min-h-[72px] resize-y" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const DNA_KINDS: GuidelineDnaElement["kind"][] = ["glow", "gradient", "marquee", "grid", "plain"];
const TYPE_VARIANTS: GuidelineTypeSpecimen["variant"][] = [
  "display-xl",
  "display",
  "heading",
  "subheading",
  "label",
  "body",
  "caption",
  "pills",
];
const USAGE_LAYOUTS: GuidelineUsageExample["layout"][] = ["social", "card", "hero"];

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border border-border bg-background hover:border-accent/40 text-text-secondary"
    >
      {children}
    </button>
  );
}

export function BrandGuidelineEditor({
  doc,
  onChange,
  clientId,
  onNotify,
}: {
  doc: BrandGuidelineDocument;
  onChange: (next: BrandGuidelineDocument) => void;
  clientId: string;
  onNotify?: (message: string, kind?: "ok" | "err") => void;
}) {
  const set = (patch: Partial<BrandGuidelineDocument>) => onChange({ ...doc, ...patch });

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ brandShell: true });
  const isOpen = (id: string) => Boolean(openMap[id]);
  const toggle = (id: string) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));
  const jump = (id: string) => {
    setOpenMap((m) => ({ ...m, [id]: true }));
    requestAnimationFrame(() => {
      document.getElementById(`acc-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const done: Record<string, boolean> = {
    brandShell: Boolean(doc.brandName.trim()),
    nav: doc.nav.length > 0,
    hero: doc.hero.titleLines.length > 0 || Boolean(doc.hero.description.trim()),
    logos: doc.logos.marks.length > 0 || doc.logos.wordmarks.length > 0,
    visualDna: doc.visualDna.elements.length > 0,
    colors:
      doc.colors.neons.length > 0 ||
      doc.colors.band.length > 0 ||
      doc.colors.neutrals.length > 0 ||
      doc.colors.blues.length > 0,
    typography: doc.typography.specimens.length > 0 || Boolean(doc.typography.fontFamily.trim()),
    backgrounds: doc.backgrounds.slots.length > 0,
    voice: doc.voice.pillars.length > 0 || doc.voice.dos.length > 0 || doc.voice.donts.length > 0,
    usage: doc.usage.examples.length > 0,
  };
  const doneCount = BRAND_SECTIONS.filter((s) => done[s.id]).length;

  async function onSlotFile(i: number, file: File | undefined) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slot_index", String(i));
    const res = await uploadBrandGuidelineBackgroundImage(clientId, fd);
    if ("error" in res && res.error) {
      onNotify?.(res.error, "err");
      return;
    }
    if ("publicUrl" in res && typeof res.publicUrl === "string") {
      const slots = doc.backgrounds.slots.map((s, j) =>
        j === i ? { ...s, imageUrl: res.publicUrl } : s
      );
      onChange({ ...doc, backgrounds: { ...doc.backgrounds, slots } });
      onNotify?.("Background image uploaded.", "ok");
    }
  }

  return (
    <div className="space-y-6 text-sm">
      <section className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Ready blocks</h3>
        <p className="text-[10px] text-text-muted">
          One click drops a complete, editable section in — start from these instead of a blank page.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {BRAND_STARTER_BLOCKS.map((b) => (
            <button
              key={b.key}
              type="button"
              title={b.hint}
              onClick={() => onChange(b.apply(doc))}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                b.key === "full"
                  ? "border-accent/60 bg-accent/15 text-text-primary hover:bg-accent/25"
                  : "border-border bg-background text-text-secondary hover:border-accent/50 hover:text-text-primary"
              }`}
            >
              {b.key === "full" ? "★ " : "+ "}
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <div className="sticky top-0 z-10 rounded-xl border border-border bg-surface/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Sections · {doneCount}/{BRAND_SECTIONS.length} filled
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                setOpenMap(Object.fromEntries(BRAND_SECTIONS.map((s) => [s.id, true])))
              }
              className="text-[10px] font-medium text-text-muted hover:text-text-primary"
            >
              Expand all
            </button>
            <span className="text-text-muted">·</span>
            <button
              type="button"
              onClick={() => setOpenMap({})}
              className="text-[10px] font-medium text-text-muted hover:text-text-primary"
            >
              Collapse all
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {BRAND_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${done[s.id] ? "bg-accent" : "bg-border"}`}
                aria-hidden
              />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Acc
        id="brandShell"
        title="Brand shell"
        complete={done.brandShell}
        open={isOpen("brandShell")}
        onToggle={() => toggle("brandShell")}
      >
        <Field label="Brand name">
          <input
            className={inputClass()}
            value={doc.brandName}
            onChange={(e) => set({ brandName: e.target.value })}
          />
        </Field>
        <Field label="Accent color">
          <input
            className={inputClass()}
            value={doc.accentColor}
            onChange={(e) => set({ accentColor: e.target.value })}
          />
        </Field>
        <Field label="Sidebar subtitle">
          <input
            className={inputClass()}
            value={doc.sidebarSubtitle}
            onChange={(e) => set({ sidebarSubtitle: e.target.value })}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="showVer"
            type="checkbox"
            checked={doc.showVersionTag}
            onChange={(e) => set({ showVersionTag: e.target.checked })}
            className="rounded border-border"
          />
          <label htmlFor="showVer" className="text-xs text-text-secondary">
            Show version in sidebar
          </label>
        </div>
        <Field label="Version label">
          <input
            className={inputClass()}
            value={doc.versionLabel}
            onChange={(e) => set({ versionLabel: e.target.value })}
          />
        </Field>
      </Acc>

      <Acc
        id="nav"
        title="Sidebar nav"
        complete={done.nav}
        open={isOpen("nav")}
        onToggle={() => toggle("nav")}
        headerRight={
          <MiniBtn
            onClick={() =>
              set({
                nav: [
                  ...doc.nav,
                  {
                    id: `section-${doc.nav.length + 1}`,
                    label: "New",
                    group: "Identity",
                    dotColor: doc.accentColor,
                  },
                ],
              })
            }
          >
            Add item
          </MiniBtn>
        }
      >
        <p className="text-[10px] text-text-muted">
          Keep <code className="text-text-secondary">id</code> stable (matches preview sections) or add new
          sections and we&apos;ll wire anchors later.
        </p>
        {doc.nav.map((item, i) => (
          <div key={`${item.id}-${i}`} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] text-text-muted">#{i + 1}</span>
              <MiniBtn
                onClick={() => set({ nav: doc.nav.filter((_, j) => j !== i) })}
              >
                Remove
              </MiniBtn>
            </div>
            <Field label="Id (anchor)">
              <input
                className={inputClass()}
                value={item.id}
                onChange={(e) => {
                  const nav = doc.nav.map((n, j) => (j === i ? { ...n, id: e.target.value } : n));
                  set({ nav });
                }}
              />
            </Field>
            <Field label="Label">
              <input
                className={inputClass()}
                value={item.label}
                onChange={(e) => {
                  const nav = doc.nav.map((n, j) => (j === i ? { ...n, label: e.target.value } : n));
                  set({ nav });
                }}
              />
            </Field>
            <Field label="Group">
              <input
                className={inputClass()}
                value={item.group}
                onChange={(e) => {
                  const nav = doc.nav.map((n, j) => (j === i ? { ...n, group: e.target.value } : n));
                  set({ nav });
                }}
              />
            </Field>
            <Field label="Dot color">
              <input
                className={inputClass()}
                value={item.dotColor}
                onChange={(e) => {
                  const nav = doc.nav.map((n, j) => (j === i ? { ...n, dotColor: e.target.value } : n));
                  set({ nav });
                }}
              />
            </Field>
          </div>
        ))}
      </Acc>

      <Acc
        id="hero"
        title="Hero"
        complete={done.hero}
        open={isOpen("hero")}
        onToggle={() => toggle("hero")}
      >
        <Field label="Badge">
          <input
            className={inputClass()}
            value={doc.hero.badge}
            onChange={(e) => onChange({ ...doc, hero: { ...doc.hero, badge: e.target.value } })}
          />
        </Field>
        <Field label="Title lines (one per line)">
          <textarea
            className={inputClass(true)}
            value={doc.hero.titleLines.join("\n")}
            onChange={(e) =>
              onChange({
                ...doc,
                hero: {
                  ...doc.hero,
                  titleLines: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                },
              })
            }
          />
        </Field>
        <Field label="Accent line index (0-based, empty = none)">
          <input
            className={inputClass()}
            type="text"
            inputMode="numeric"
            value={doc.hero.accentLineIndex ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...doc,
                hero: {
                  ...doc.hero,
                  accentLineIndex: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
                },
              });
            }}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.hero.description}
            onChange={(e) => onChange({ ...doc, hero: { ...doc.hero, description: e.target.value } })}
          />
        </Field>
        <Field label="Meta tags (comma-separated)">
          <input
            className={inputClass()}
            value={doc.hero.metaTags.join(", ")}
            onChange={(e) =>
              onChange({
                ...doc,
                hero: {
                  ...doc.hero,
                  metaTags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                },
              })
            }
          />
        </Field>
      </Acc>

      <Acc
        id="logos"
        title="Logo system"
        complete={done.logos}
        open={isOpen("logos")}
        onToggle={() => toggle("logos")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.logos.eyebrow}
            onChange={(e) => onChange({ ...doc, logos: { ...doc.logos, eyebrow: e.target.value } })}
          />
        </Field>
        <Field label="Section title">
          <input
            className={inputClass()}
            value={doc.logos.title}
            onChange={(e) => onChange({ ...doc, logos: { ...doc.logos, title: e.target.value } })}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.logos.description}
            onChange={(e) => onChange({ ...doc, logos: { ...doc.logos, description: e.target.value } })}
          />
        </Field>
        <Field label="Marks group label">
          <input
            className={inputClass()}
            value={doc.logos.marksLabel}
            onChange={(e) => onChange({ ...doc, logos: { ...doc.logos, marksLabel: e.target.value } })}
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-text-muted">Marks</span>
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                logos: {
                  ...doc.logos,
                  marks: [
                    ...doc.logos.marks,
                    {
                      bg: "#232323",
                      fill: "#F2F7F7",
                      label: "New mark",
                      desc: "",
                    },
                  ],
                },
              })
            }
          >
            Add mark
          </MiniBtn>
        </div>
        {doc.logos.marks.map((m, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2 text-[11px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={!!m.preferred}
                  onChange={() => {
                    const marks = doc.logos.marks.map((row, j) => ({
                      ...row,
                      preferred: j === i ? !row.preferred : false,
                    }));
                    onChange({ ...doc, logos: { ...doc.logos, marks } });
                  }}
                />
                Preferred
              </label>
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    logos: { ...doc.logos, marks: doc.logos.marks.filter((_, j) => j !== i) },
                  })
                }
              >
                Remove
              </MiniBtn>
            </div>
            <Field label="Background">
              <input
                className={inputClass()}
                value={m.bg}
                onChange={(e) => {
                  const marks = doc.logos.marks.map((row, j) => (j === i ? { ...row, bg: e.target.value } : row));
                  onChange({ ...doc, logos: { ...doc.logos, marks } });
                }}
              />
            </Field>
            <Field label="Fill (#hex or gradient)">
              <input
                className={inputClass()}
                value={m.fill}
                onChange={(e) => {
                  const marks = doc.logos.marks.map((row, j) =>
                    j === i ? { ...row, fill: e.target.value } : row
                  );
                  onChange({ ...doc, logos: { ...doc.logos, marks } });
                }}
              />
            </Field>
            <Field label="Label">
              <input
                className={inputClass()}
                value={m.label}
                onChange={(e) => {
                  const marks = doc.logos.marks.map((row, j) =>
                    j === i ? { ...row, label: e.target.value } : row
                  );
                  onChange({ ...doc, logos: { ...doc.logos, marks } });
                }}
              />
            </Field>
            <Field label="Description">
              <input
                className={inputClass()}
                value={m.desc}
                onChange={(e) => {
                  const marks = doc.logos.marks.map((row, j) =>
                    j === i ? { ...row, desc: e.target.value } : row
                  );
                  onChange({ ...doc, logos: { ...doc.logos, marks } });
                }}
              />
            </Field>
          </div>
        ))}

        <Field label="Wordmarks group label">
          <input
            className={inputClass()}
            value={doc.logos.wordmarksLabel}
            onChange={(e) =>
              onChange({ ...doc, logos: { ...doc.logos, wordmarksLabel: e.target.value } })
            }
          />
        </Field>
        <div className="flex justify-end">
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                logos: {
                  ...doc.logos,
                  wordmarks: [
                    ...doc.logos.wordmarks,
                    {
                      bg: "#232323",
                      mFill: "#F2F7F7",
                      text: "#F2F7F7",
                      sub: doc.accentColor,
                      label: "Wordmark",
                      desc: "",
                      line1: doc.brandName.toUpperCase(),
                      line2: "TAGLINE",
                    },
                  ],
                },
              })
            }
          >
            Add wordmark
          </MiniBtn>
        </div>
        {doc.logos.wordmarks.map((w, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-end">
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    logos: {
                      ...doc.logos,
                      wordmarks: doc.logos.wordmarks.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                Remove
              </MiniBtn>
            </div>
            {(["bg", "mFill", "text", "sub", "label", "desc", "line1", "line2"] as const).map((key) => (
              <Field key={key} label={key}>
                <input
                  className={inputClass()}
                  value={w[key]}
                  onChange={(e) => {
                    const wordmarks = doc.logos.wordmarks.map((row, j) =>
                      j === i ? { ...row, [key]: e.target.value } : row
                    );
                    onChange({ ...doc, logos: { ...doc.logos, wordmarks } });
                  }}
                />
              </Field>
            ))}
          </div>
        ))}
      </Acc>

      <Acc
        id="visualDna"
        title="Visual DNA"
        complete={done.visualDna}
        open={isOpen("visualDna")}
        onToggle={() => toggle("visualDna")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.visualDna.eyebrow}
            onChange={(e) =>
              onChange({ ...doc, visualDna: { ...doc.visualDna, eyebrow: e.target.value } })
            }
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass()}
            value={doc.visualDna.title}
            onChange={(e) =>
              onChange({ ...doc, visualDna: { ...doc.visualDna, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.visualDna.description}
            onChange={(e) =>
              onChange({ ...doc, visualDna: { ...doc.visualDna, description: e.target.value } })
            }
          />
        </Field>
        <div className="flex justify-end">
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                visualDna: {
                  ...doc.visualDna,
                  elements: [...doc.visualDna.elements, { name: "Element", desc: "", kind: "plain" }],
                },
              })
            }
          >
            Add element
          </MiniBtn>
        </div>
        {doc.visualDna.elements.map((el, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-end">
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    visualDna: {
                      ...doc.visualDna,
                      elements: doc.visualDna.elements.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                Remove
              </MiniBtn>
            </div>
            <Field label="Name">
              <input
                className={inputClass()}
                value={el.name}
                onChange={(e) => {
                  const elements = doc.visualDna.elements.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x
                  );
                  onChange({ ...doc, visualDna: { ...doc.visualDna, elements } });
                }}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={inputClass(true)}
                value={el.desc}
                onChange={(e) => {
                  const elements = doc.visualDna.elements.map((x, j) =>
                    j === i ? { ...x, desc: e.target.value } : x
                  );
                  onChange({ ...doc, visualDna: { ...doc.visualDna, elements } });
                }}
              />
            </Field>
            <Field label="Canvas kind">
              <select
                className={inputClass()}
                value={el.kind}
                onChange={(e) => {
                  const kind = e.target.value as GuidelineDnaElement["kind"];
                  const elements = doc.visualDna.elements.map((x, j) =>
                    j === i ? { ...x, kind } : x
                  );
                  onChange({ ...doc, visualDna: { ...doc.visualDna, elements } });
                }}
              >
                {DNA_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </Acc>

      <Acc
        id="colors"
        title="Color"
        complete={done.colors}
        open={isOpen("colors")}
        onToggle={() => toggle("colors")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.colors.eyebrow}
            onChange={(e) => onChange({ ...doc, colors: { ...doc.colors, eyebrow: e.target.value } })}
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass()}
            value={doc.colors.title}
            onChange={(e) => onChange({ ...doc, colors: { ...doc.colors, title: e.target.value } })}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.colors.description}
            onChange={(e) =>
              onChange({ ...doc, colors: { ...doc.colors, description: e.target.value } })
            }
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase text-text-muted">Top band</span>
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                colors: {
                  ...doc.colors,
                  band: [...doc.colors.band, { hex: "#FFFFFF", name: "Swatch" }],
                },
              })
            }
          >
            Add
          </MiniBtn>
        </div>
        {doc.colors.band.map((b, i) => (
          <div key={i} className="flex gap-2 items-end">
            <Field label="Hex">
              <input
                className={inputClass()}
                value={b.hex}
                onChange={(e) => {
                  const band = doc.colors.band.map((x, j) =>
                    j === i ? { ...x, hex: e.target.value } : x
                  );
                  onChange({ ...doc, colors: { ...doc.colors, band } });
                }}
              />
            </Field>
            <Field label="Name">
              <input
                className={inputClass()}
                value={b.name}
                onChange={(e) => {
                  const band = doc.colors.band.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x
                  );
                  onChange({ ...doc, colors: { ...doc.colors, band } });
                }}
              />
            </Field>
            <MiniBtn
              onClick={() =>
                onChange({
                  ...doc,
                  colors: { ...doc.colors, band: doc.colors.band.filter((_, j) => j !== i) },
                })
              }
            >
              ✕
            </MiniBtn>
          </div>
        ))}

        {(
          [
            ["Neons", "neons" as const],
            ["Blues", "blues" as const],
            ["Neutrals", "neutrals" as const],
          ] as const
        ).map(([label, key]) => (
          <div key={key} className="pt-2 border-t border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-text-muted">{label}</span>
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    colors: {
                      ...doc.colors,
                      [key]: [
                        ...doc.colors[key],
                        { bg: "#000000", name: "New", hex: "#000000", role: "" },
                      ],
                    },
                  })
                }
              >
                Add row
              </MiniBtn>
            </div>
            {doc.colors[key].map((c, i) => (
              <div key={i} className="rounded-lg border border-border-subtle p-2 space-y-2 bg-background/50">
                <div className="flex justify-end">
                  <MiniBtn
                    onClick={() =>
                      onChange({
                        ...doc,
                        colors: {
                          ...doc.colors,
                          [key]: doc.colors[key].filter((_, j) => j !== i),
                        },
                      })
                    }
                  >
                    Remove
                  </MiniBtn>
                </div>
                {(["bg", "name", "hex", "role"] as const).map((f) => (
                  <Field key={f} label={f}>
                    <input
                      className={inputClass()}
                      value={c[f]}
                      onChange={(e) => {
                        const rows = doc.colors[key].map((row, j) =>
                          j === i ? { ...row, [f]: e.target.value } : row
                        );
                        onChange({ ...doc, colors: { ...doc.colors, [key]: rows } });
                      }}
                    />
                  </Field>
                ))}
              </div>
            ))}
          </div>
        ))}
      </Acc>

      <Acc
        id="typography"
        title="Typography"
        complete={done.typography}
        open={isOpen("typography")}
        onToggle={() => toggle("typography")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.typography.eyebrow}
            onChange={(e) =>
              onChange({ ...doc, typography: { ...doc.typography, eyebrow: e.target.value } })
            }
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass()}
            value={doc.typography.title}
            onChange={(e) =>
              onChange({ ...doc, typography: { ...doc.typography, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Section description">
          <textarea
            className={inputClass(true)}
            value={doc.typography.description}
            onChange={(e) =>
              onChange({ ...doc, typography: { ...doc.typography, description: e.target.value } })
            }
          />
        </Field>
        <Field label="Font stack">
          <input
            className={inputClass()}
            value={doc.typography.fontFamily}
            onChange={(e) =>
              onChange({ ...doc, typography: { ...doc.typography, fontFamily: e.target.value } })
            }
          />
        </Field>
        <div className="flex justify-end">
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                typography: {
                  ...doc.typography,
                  specimens: [
                    ...doc.typography.specimens,
                    { label: "Specimen", sample: "Sample", variant: "body" },
                  ],
                },
              })
            }
          >
            Add specimen
          </MiniBtn>
        </div>
        {doc.typography.specimens.map((s, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-end">
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    typography: {
                      ...doc.typography,
                      specimens: doc.typography.specimens.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                Remove
              </MiniBtn>
            </div>
            <Field label="Label">
              <input
                className={inputClass()}
                value={s.label}
                onChange={(e) => {
                  const specimens = doc.typography.specimens.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x
                  );
                  onChange({ ...doc, typography: { ...doc.typography, specimens } });
                }}
              />
            </Field>
            <Field label="Sample text">
              <textarea
                className={inputClass(true)}
                value={s.sample}
                onChange={(e) => {
                  const specimens = doc.typography.specimens.map((x, j) =>
                    j === i ? { ...x, sample: e.target.value } : x
                  );
                  onChange({ ...doc, typography: { ...doc.typography, specimens } });
                }}
              />
            </Field>
            <Field label="Variant">
              <select
                className={inputClass()}
                value={s.variant}
                onChange={(e) => {
                  const variant = e.target.value as GuidelineTypeSpecimen["variant"];
                  const specimens = doc.typography.specimens.map((x, j) =>
                    j === i ? { ...x, variant } : x
                  );
                  onChange({ ...doc, typography: { ...doc.typography, specimens } });
                }}
              >
                {TYPE_VARIANTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </Acc>

      <Acc
        id="backgrounds"
        title="Backgrounds"
        complete={done.backgrounds}
        open={isOpen("backgrounds")}
        onToggle={() => toggle("backgrounds")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.backgrounds.eyebrow}
            onChange={(e) =>
              onChange({ ...doc, backgrounds: { ...doc.backgrounds, eyebrow: e.target.value } })
            }
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass()}
            value={doc.backgrounds.title}
            onChange={(e) =>
              onChange({ ...doc, backgrounds: { ...doc.backgrounds, title: e.target.value } })
            }
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.backgrounds.description}
            onChange={(e) =>
              onChange({ ...doc, backgrounds: { ...doc.backgrounds, description: e.target.value } })
            }
          />
        </Field>
        <div className="flex justify-end">
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                backgrounds: {
                  ...doc.backgrounds,
                  slots: [...doc.backgrounds.slots, { name: "New slot" }],
                },
              })
            }
          >
            Add slot
          </MiniBtn>
        </div>
        {doc.backgrounds.slots.map((slot, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] text-text-muted">Slot {i + 1}</span>
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    backgrounds: {
                      ...doc.backgrounds,
                      slots: doc.backgrounds.slots.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                Remove
              </MiniBtn>
            </div>
            <Field label="Name">
              <input
                className={inputClass()}
                value={slot.name}
                onChange={(e) => {
                  const slots = doc.backgrounds.slots.map((s, j) =>
                    j === i ? { ...s, name: e.target.value } : s
                  );
                  onChange({ ...doc, backgrounds: { ...doc.backgrounds, slots } });
                }}
              />
            </Field>
            <Field label="Image URL (optional)">
              <input
                className={inputClass()}
                value={slot.imageUrl ?? ""}
                placeholder="https://… or upload below"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const slots = doc.backgrounds.slots.map((s, j) =>
                    j === i ? { ...s, imageUrl: v || null } : s
                  );
                  onChange({ ...doc, backgrounds: { ...doc.backgrounds, slots } });
                }}
              />
            </Field>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block mb-1.5">
                Upload to storage
              </span>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-[11px] text-text-secondary file:mr-2 file:rounded file:border file:border-border file:bg-surface-raised file:px-2 file:py-1"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  void onSlotFile(i, f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        ))}
      </Acc>

      <Acc
        id="voice"
        title="Voice & tone"
        complete={done.voice}
        open={isOpen("voice")}
        onToggle={() => toggle("voice")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.voice.eyebrow}
            onChange={(e) => onChange({ ...doc, voice: { ...doc.voice, eyebrow: e.target.value } })}
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass()}
            value={doc.voice.title}
            onChange={(e) => onChange({ ...doc, voice: { ...doc.voice, title: e.target.value } })}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.voice.description}
            onChange={(e) => onChange({ ...doc, voice: { ...doc.voice, description: e.target.value } })}
          />
        </Field>
        <div className="flex justify-end">
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                voice: {
                  ...doc.voice,
                  pillars: [...doc.voice.pillars, { label: "Pillar", phrase: "PHRASE" }],
                },
              })
            }
          >
            Add pillar
          </MiniBtn>
        </div>
        {doc.voice.pillars.map((p, i) => (
          <div key={i} className="flex gap-2 items-end">
            <Field label="Label">
              <input
                className={inputClass()}
                value={p.label}
                onChange={(e) => {
                  const pillars = doc.voice.pillars.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x
                  );
                  onChange({ ...doc, voice: { ...doc.voice, pillars } });
                }}
              />
            </Field>
            <Field label="Phrase">
              <input
                className={inputClass()}
                value={p.phrase}
                onChange={(e) => {
                  const pillars = doc.voice.pillars.map((x, j) =>
                    j === i ? { ...x, phrase: e.target.value } : x
                  );
                  onChange({ ...doc, voice: { ...doc.voice, pillars } });
                }}
              />
            </Field>
            <MiniBtn
              onClick={() =>
                onChange({
                  ...doc,
                  voice: { ...doc.voice, pillars: doc.voice.pillars.filter((_, j) => j !== i) },
                })
              }
            >
              ✕
            </MiniBtn>
          </div>
        ))}
        <Field label="Do (one per line)">
          <textarea
            className={inputClass(true)}
            value={doc.voice.dos.join("\n")}
            onChange={(e) =>
              onChange({
                ...doc,
                voice: {
                  ...doc.voice,
                  dos: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                },
              })
            }
          />
        </Field>
        <Field label="Don&apos;t (one per line)">
          <textarea
            className={inputClass(true)}
            value={doc.voice.donts.join("\n")}
            onChange={(e) =>
              onChange({
                ...doc,
                voice: {
                  ...doc.voice,
                  donts: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                },
              })
            }
          />
        </Field>
      </Acc>

      <Acc
        id="usage"
        title="Usage examples"
        complete={done.usage}
        open={isOpen("usage")}
        onToggle={() => toggle("usage")}
      >
        <Field label="Eyebrow">
          <input
            className={inputClass()}
            value={doc.usage.eyebrow}
            onChange={(e) => onChange({ ...doc, usage: { ...doc.usage, eyebrow: e.target.value } })}
          />
        </Field>
        <Field label="Title">
          <input
            className={inputClass()}
            value={doc.usage.title}
            onChange={(e) => onChange({ ...doc, usage: { ...doc.usage, title: e.target.value } })}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={inputClass(true)}
            value={doc.usage.description}
            onChange={(e) =>
              onChange({ ...doc, usage: { ...doc.usage, description: e.target.value } })
            }
          />
        </Field>
        <div className="flex justify-end">
          <MiniBtn
            onClick={() =>
              onChange({
                ...doc,
                usage: {
                  ...doc.usage,
                  examples: [
                    ...doc.usage.examples,
                    { title: "Example", caption: "Caption", layout: "social" },
                  ],
                },
              })
            }
          >
            Add example
          </MiniBtn>
        </div>
        {doc.usage.examples.map((ex, i) => (
          <div key={i} className="rounded-lg border border-border-subtle p-3 space-y-2 bg-background/50">
            <div className="flex justify-end">
              <MiniBtn
                onClick={() =>
                  onChange({
                    ...doc,
                    usage: {
                      ...doc.usage,
                      examples: doc.usage.examples.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                Remove
              </MiniBtn>
            </div>
            <Field label="Title">
              <input
                className={inputClass()}
                value={ex.title}
                onChange={(e) => {
                  const examples = doc.usage.examples.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x
                  );
                  onChange({ ...doc, usage: { ...doc.usage, examples } });
                }}
              />
            </Field>
            <Field label="Caption">
              <input
                className={inputClass()}
                value={ex.caption}
                onChange={(e) => {
                  const examples = doc.usage.examples.map((x, j) =>
                    j === i ? { ...x, caption: e.target.value } : x
                  );
                  onChange({ ...doc, usage: { ...doc.usage, examples } });
                }}
              />
            </Field>
            <Field label="Layout">
              <select
                className={inputClass()}
                value={ex.layout}
                onChange={(e) => {
                  const layout = e.target.value as GuidelineUsageExample["layout"];
                  const examples = doc.usage.examples.map((x, j) =>
                    j === i ? { ...x, layout } : x
                  );
                  onChange({ ...doc, usage: { ...doc.usage, examples } });
                }}
              >
                {USAGE_LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </Acc>
    </div>
  );
}
