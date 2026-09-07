"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CiClientTemplate } from "@/lib/ci-builder/types";
import { generateUUID } from "@/lib/ci-builder/types";
import { resetCiGuideline } from "@/app/actions/ci-builder";
import { triggerToast } from "@/components/ci-builder/Toast";
import { BackToProjectLink, DrawerActions, DrawerShell, ImageWell, ToggleGroup, assetSrc } from "./ui";
import { resolveTemplate, useCanvas } from "./CiCanvasContext";
import { PublishModal } from "@/components/ci-builder/PublishModal";

const FigmaImportWizard = dynamic(
  () => import("@/components/ci-builder/FigmaImportWizard").then((m) => m.FigmaImportWizard),
  { ssr: false }
);

export function SettingsAndTemplateDrawers() {
  const c = useCanvas();
  const [showFigma, setShowFigma] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [poc, setPoc] = useState("");
  const [email, setEmail] = useState("");
  const template = resolveTemplate(c.theme);

  async function handleResetGuideline() {
    const ok = window.confirm(
      "This deletes all sections, assets, and published versions. Linked Figma file stays so you can Import again."
    );
    if (!ok) return;
    setResetBusy(true);
    try {
      const res = await resetCiGuideline(c.projectId);
      if (!res.ok) throw new Error(res.error || "Reset failed");
      triggerToast("Guideline reset — use Import from Figma for a clean import");
      await c.reload();
      c.closeDrawer();
    } catch (err: any) {
      triggerToast(err?.message || "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  useEffect(() => {
    if (c.drawer?.kind !== "settings") return;
    setTeamName(c.theme.teamName || "");
    setPoc(c.theme.pointOfContact || "");
    setEmail(c.theme.contactEmail || "");
  }, [c.drawer, c.theme]);

  return (
    <>
      {c.drawer?.kind === "settings" ? (
        <DrawerShell title="Brand kit settings" onClose={c.closeDrawer}>
          <BackToProjectLink projectId={c.projectId} />
          <div>
            <span className="field-label">Brand name</span>
            <input
              className="field-input"
              value={c.brandName}
              onChange={(e) => c.setBrandName(e.target.value)}
            />
            <span style={{ fontSize: 11, color: "var(--tool-text-muted)", display: "block", marginTop: 6 }}>
              Display name for this kit. Does not rename the project record.
            </span>
          </div>
          <div>
            <span className="field-label">Team name</span>
            <input className="field-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          </div>
          <div>
            <span className="field-label">Point of contact</span>
            <input className="field-input" value={poc} onChange={(e) => setPoc(e.target.value)} />
          </div>
          <div>
            <span className="field-label">Contact email</span>
            <input className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="field-label">Figma</span>
            <span
              className="page-edit-btn"
              style={{ justifyContent: "center" }}
              onClick={() => setShowFigma(true)}
            >
              Import from Figma
            </span>
            <span
              style={{ fontSize: 13, color: "var(--tool-text-link)", cursor: "pointer" }}
              onClick={() => c.openDrawer({ kind: "unassigned" })}
            >
              Unassigned assets ({c.unassigned.length})
            </span>
            {c.theme.figmaSync?.lastSyncedAt ? (
              <span style={{ fontSize: 11, color: "var(--tool-text-muted)" }}>
                Last sync {new Date(c.theme.figmaSync.lastSyncedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
          <div>
            <span className="field-label">Publish</span>
            <span className="page-edit-btn" style={{ justifyContent: "center" }} onClick={() => setShowPublish(true)}>
              Publish guideline
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="field-label">Danger zone</span>
            <span style={{ fontSize: 11, color: "var(--tool-text-muted)", lineHeight: 1.5 }}>
              Wipe sections, assets, and published versions. Figma link is kept — Import again to refill.
            </span>
            <span
              className="page-edit-btn"
              style={{
                justifyContent: "center",
                opacity: resetBusy ? 0.55 : 1,
                pointerEvents: resetBusy ? "none" : "auto",
                color: "var(--tool-text-primary)",
                borderColor: "rgba(220, 80, 80, 0.45)",
              }}
              onClick={() => void handleResetGuideline()}
            >
              {resetBusy ? "Resetting…" : "Reset guideline"}
            </span>
          </div>
          <DrawerActions
            onCancel={c.closeDrawer}
            onSave={() => {
              void c.updateTheme({
                teamName,
                pointOfContact: poc,
                contactEmail: email,
                coverTitle: c.brandName,
              });
              c.closeDrawer();
            }}
          />
        </DrawerShell>
      ) : null}

      {c.drawer?.kind === "template" ? (
        <TemplateSettingsDrawer template={template} />
      ) : null}

      {c.drawer?.kind === "unassigned" ? (
        <DrawerShell title="Unassigned assets" onClose={c.closeDrawer}>
          <span style={{ fontSize: 13, color: "var(--tool-text-muted)", lineHeight: 1.6 }}>
            Frames that didn’t map to a canvas module. Assign them from Edit wells, or re-run Import.
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {c.unassigned.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    background: a.public_url ? `url(${a.public_url}) center/contain no-repeat` : "var(--tool-surface-card)",
                    border: "1px solid var(--tool-border-input)",
                  }}
                />
                <span style={{ fontSize: 13 }}>{a.label || a.kind || a.id}</span>
              </div>
            ))}
          </div>
        </DrawerShell>
      ) : null}

      {showFigma && c.guideline?.id ? (
        <FigmaImportWizard
          guidelineId={c.guideline.id}
          projectId={c.projectId}
          linkedFigma={{
            fileKey: c.guideline.figma_file_key || null,
            fileName: c.guideline.figma_file_name || null,
            version: c.guideline.figma_file_version || null,
            lastImportedAt: c.guideline.figma_last_imported_at || null,
          }}
          onClose={() => setShowFigma(false)}
          onImported={(result) => {
            void c.applyFigmaImport(result);
            setShowFigma(false);
          }}
        />
      ) : null}

      {showPublish ? (
        <PublishModal
          guideline={c.guideline}
          sections={c.sections}
          assets={c.assets}
          onClose={() => setShowPublish(false)}
          onFlushSaves={c.flushPendingSaves}
          saveStatus={c.saveStatus}
          onPublished={() => {
            triggerToast("Published");
            void c.reload();
          }}
        />
      ) : null}
    </>
  );
}

function TemplateSettingsDrawer({ template }: { template: CiClientTemplate }) {
  const c = useCanvas();
  const mp = c.theme.templateSettings?.multipage || {};
  const [radius, setRadius] = useState<"none" | "soft" | "round">(mp.cornerRadius || "soft");
  const [spacing, setSpacing] = useState<"compact" | "comfortable" | "airy">(
    mp.sectionSpacing === "airy" ? "airy" : mp.sectionSpacing || "comfortable"
  );
  const [tiles, setTiles] = useState<"cycle" | "accent">(
    mp.landingTileColorMode === "accent" ? "accent" : "cycle"
  );
  const [showNext, setShowNext] = useState(mp.showNextModuleCard !== false);
  const [headerId, setHeaderId] = useState(mp.headerImageAssetId || "");

  const titleMap = { greenpoint: "Greenpoint", foundry: "Foundry", multipage: "Multipage" };

  if (template !== "multipage") {
    return (
      <DrawerShell title={`Template Settings — ${titleMap[template]}`} onClose={c.closeDrawer}>
        <span style={{ fontSize: 13, color: "var(--tool-text-muted)", lineHeight: 1.6 }}>
          This template doesn’t have any global style settings yet.
        </span>
      </DrawerShell>
    );
  }

  const headerUrl = assetSrc(c.assets, headerId);

  return (
    <DrawerShell title="Template Settings — Multipage" onClose={c.closeDrawer}>
      <div>
        <span className="field-label">Header Image</span>
        {c.guideline?.id ? (
          <ImageWell
            url={headerUrl}
            guidelineId={c.guideline.id}
            assets={c.assets}
            onAddAsset={(a) => void c.addAsset(a)}
            onSelect={(a) => setHeaderId(a.id || "")}
            size="100%"
            label="Click to upload image"
          />
        ) : null}
        {headerId ? (
          <span
            style={{ fontSize: 12, color: "var(--tool-text-link)", cursor: "pointer", display: "block", marginTop: 6 }}
            onClick={() => setHeaderId("")}
          >
            Remove
          </span>
        ) : null}
        <span style={{ fontSize: 11, color: "var(--tool-text-muted)", display: "block", marginTop: 6 }}>
          Used as the background for the homepage banner and every module’s header. Leave empty for a flat dark header.
        </span>
      </div>
      <div>
        <span className="field-label">Corner Radius</span>
        <ToggleGroup
          value={radius === "none" ? "none" : radius}
          options={[
            { value: "none", label: "Sharp" },
            { value: "soft", label: "Soft" },
            { value: "round", label: "Round" },
          ]}
          onChange={(v) => setRadius(v as typeof radius)}
        />
      </div>
      <div>
        <span className="field-label">Section Spacing</span>
        <ToggleGroup
          value={spacing}
          options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "airy", label: "Spacious" },
          ]}
          onChange={(v) => setSpacing(v as typeof spacing)}
        />
      </div>
      <div>
        <span className="field-label">Landing Tile Colors</span>
        <ToggleGroup
          value={tiles}
          options={[
            { value: "cycle", label: "Cycle palette" },
            { value: "accent", label: "Single color" },
          ]}
          onChange={(v) => setTiles(v as typeof tiles)}
        />
        <span style={{ fontSize: 11, color: "var(--tool-text-muted)", display: "block", marginTop: 6 }}>
          Cycle walks through Color System shades. Single color fills every tile with the brand primary.
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, color: "var(--tool-text-primary)" }}>Show “Next module” card</span>
          <span style={{ fontSize: 11, color: "var(--tool-text-muted)" }}>
            The inset link to the next module at the bottom of each page.
          </span>
        </div>
        <div
          onClick={() => setShowNext(!showNext)}
          style={{
            width: 40,
            height: 22,
            borderRadius: 20,
            flex: "none",
            cursor: "pointer",
            background: showNext ? "var(--tool-accent-primary)" : "var(--tool-border-input)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 3,
              ...(showNext ? { right: 3 } : { left: 3 }),
            }}
          />
        </div>
      </div>
      <DrawerActions
        onCancel={c.closeDrawer}
        onSave={() => {
          void c.updateTheme({
            templateSettings: {
              ...(c.theme.templateSettings || {}),
              multipage: {
                headerImageAssetId: headerId || undefined,
                cornerRadius: radius,
                sectionSpacing: spacing,
                landingTileColorMode: tiles === "accent" ? "accent" : "cycle",
                showNextModuleCard: showNext,
              },
            },
          });
          c.closeDrawer();
        }}
      />
    </DrawerShell>
  );
}

export function useLinkDrawer() {
  const c = useCanvas();
  const d = c.drawer?.kind === "link" ? c.drawer : null;
  const sec = d ? c.sectionByType(d.sectionType) : null;
  const links = ((sec?.data as { links?: { id: string; label: string; url: string }[] })?.links || []) as {
    id: string;
    label: string;
    url: string;
  }[];
  const current = d?.linkId ? links.find((l) => l.id === d.linkId) : null;
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!d) return;
    setLabel(current?.label || "");
    setUrl(current?.url || "");
  }, [d?.sectionType, d?.linkId, current?.label, current?.url]);

  if (!d) return null;

  return (
    <DrawerShell title={d.linkId ? "Edit download link" : "Add download link"} onClose={c.closeDrawer}>
      <div>
        <span className="field-label">Label</span>
        <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <span className="field-label">URL</span>
        <input className="field-input" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <DrawerActions
        onCancel={c.closeDrawer}
        onSave={() => {
          void c.patchType(d.sectionType, (data) => {
            const prev = Array.isArray(data.links) ? data.links.slice() : [];
            if (d.linkId) {
              return {
                ...data,
                links: prev.map((l: any) => (l.id === d.linkId ? { ...l, label, url } : l)),
              };
            }
            return { ...data, links: [...prev, { id: generateUUID(), label, url }] };
          });
          c.closeDrawer();
        }}
      />
    </DrawerShell>
  );
}
