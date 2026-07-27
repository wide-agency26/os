"use client";

import type {
  WebStyleGuideDocument,
  WebStyleGuideNavGroup,
  WebStyleGuideSection,
} from "@/lib/web-style-guide/document";
import { WSG_READY_BLOCKS, buildWsgSection } from "@/lib/web-style-guide/ready-blocks";

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
    multiline ? "min-h-[120px] resize-y font-mono text-[12px] leading-relaxed" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const NAV_GROUPS: WebStyleGuideNavGroup[] = ["Foundations", "Components", "Other"];

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

function newSection(sortOrder: number): WebStyleGuideSection {
  const id = `section-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    navLabel: "New section",
    navGroup: "Other",
    title: "New section",
    subtitle: "",
    bodyHtml: `<section id="${id}"><p class="paragraph_small">Edit this block HTML.</p></section>`,
    sortOrder,
    visible: true,
  };
}

export function WebStyleGuideDocumentEditor({
  doc,
  onChange,
}: {
  doc: WebStyleGuideDocument;
  onChange: (next: WebStyleGuideDocument) => void;
}) {
  const setMeta = (patch: Partial<WebStyleGuideDocument["meta"]>) =>
    onChange({ ...doc, meta: { ...doc.meta, ...patch } });

  const setSections = (sections: WebStyleGuideSection[]) => onChange({ ...doc, sections });

  const patchSection = (index: number, patch: Partial<WebStyleGuideSection>) => {
    const sections = doc.sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setSections(sections);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= doc.sections.length) return;
    const sections = [...doc.sections];
    const a = sections[index]!;
    const b = sections[j]!;
    const oa = a.sortOrder;
    sections[index] = { ...a, sortOrder: b.sortOrder };
    sections[j] = { ...b, sortOrder: oa };
    sections.sort((x, y) => x.sortOrder - y.sortOrder);
    setSections(sections);
  };

  const remove = (index: number) => {
    const next = doc.sections.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i }));
    setSections(next);
  };

  const add = () => {
    const maxOrder = doc.sections.reduce((m, s) => Math.max(m, s.sortOrder), -1);
    setSections([...doc.sections, newSection(maxOrder + 1)]);
  };

  const addReadyBlock = (key: string) => {
    const block = WSG_READY_BLOCKS.find((b) => b.key === key);
    if (!block) return;
    const maxOrder = doc.sections.reduce((m, s) => Math.max(m, s.sortOrder), -1);
    setSections([...doc.sections, buildWsgSection(block, maxOrder + 1)]);
  };

  return (
    <div className="space-y-6 text-sm">
      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Playbook meta</h3>
        <Field label="Title (internal)">
          <input
            className={inputClass()}
            value={doc.meta.title}
            onChange={(e) => setMeta({ title: e.target.value })}
          />
        </Field>
        <Field label="Version label">
          <input
            className={inputClass()}
            value={doc.meta.versionLabel}
            onChange={(e) => setMeta({ versionLabel: e.target.value })}
          />
        </Field>
        <Field label="Body class (from export)">
          <input
            className={inputClass()}
            value={doc.meta.bodyClass}
            onChange={(e) => setMeta({ bodyClass: e.target.value })}
            placeholder="e.g. body sg_body"
          />
        </Field>
        <Field label="Asset base URL (for preview + relative images)">
          <input
            className={inputClass()}
            value={doc.meta.assetBaseUrl ?? ""}
            onChange={(e) =>
              setMeta({
                assetBaseUrl: e.target.value.trim() ? e.target.value.trim() : undefined,
              })
            }
            placeholder="https://your-site.webflow.io/"
          />
          <p className="mt-1 text-[10px] text-text-muted leading-relaxed">
            Set this if icons or images break in the iframe. Imports usually infer it from your CSS URLs; you can
            override here (same value as the optional base URL on upload).
          </p>
        </Field>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Ready blocks</h3>
        <p className="text-[10px] text-text-muted">
          One click adds a fully-styled section — works even without an imported stylesheet.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {WSG_READY_BLOCKS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => addReadyBlock(b.key)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary"
            >
              + {b.label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Sections</h3>
        <MiniBtn onClick={add}>Add blank block</MiniBtn>
      </div>

      {doc.sections.length === 0 ? (
        <p className="text-xs text-text-muted rounded-xl border border-dashed border-border-subtle p-6 text-center">
          No blocks yet. Import Flowkit HTML to split into sections, or add a block.
        </p>
      ) : (
        <ul className="space-y-4">
          {doc.sections
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((sec) => {
              const index = doc.sections.indexOf(sec);
              return (
                <li key={sec.id} className="rounded-xl border border-border bg-surface p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <span className="text-[10px] font-mono text-text-muted">id: {sec.id}</span>
                    <div className="flex flex-wrap gap-1">
                      <MiniBtn onClick={() => move(index, -1)}>Up</MiniBtn>
                      <MiniBtn onClick={() => move(index, 1)}>Down</MiniBtn>
                      <MiniBtn onClick={() => remove(index)}>Remove</MiniBtn>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={sec.visible}
                      onChange={(e) => patchSection(index, { visible: e.target.checked })}
                      className="rounded border-border"
                    />
                    Visible in client preview
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nav label">
                      <input
                        className={inputClass()}
                        value={sec.navLabel}
                        onChange={(e) => patchSection(index, { navLabel: e.target.value })}
                      />
                    </Field>
                    <Field label="Group">
                      <select
                        className={inputClass()}
                        value={sec.navGroup}
                        onChange={(e) =>
                          patchSection(index, { navGroup: e.target.value as WebStyleGuideNavGroup })
                        }
                      >
                        {NAV_GROUPS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Heading title">
                    <input
                      className={inputClass()}
                      value={sec.title}
                      onChange={(e) => patchSection(index, { title: e.target.value })}
                    />
                  </Field>
                  <Field label="Subtitle">
                    <input
                      className={inputClass()}
                      value={sec.subtitle}
                      onChange={(e) => patchSection(index, { subtitle: e.target.value })}
                    />
                  </Field>
                  <Field label="Block HTML">
                    <textarea
                      className={inputClass(true)}
                      rows={10}
                      value={sec.bodyHtml}
                      onChange={(e) => patchSection(index, { bodyHtml: e.target.value })}
                    />
                  </Field>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
