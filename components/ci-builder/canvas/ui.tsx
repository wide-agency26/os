"use client";

import React, { useState } from "react";
import type { CIAsset } from "@/lib/ci-builder/types";
import { workPaths } from "@/lib/work/paths";
import { AssetPickerModal } from "@/components/ci-builder/primitives/AssetPickerModal";
import { CloseIcon, DragIcon, DupIcon, PencilIcon, TrashIcon, UploadIcon } from "./icons";
import { assetUrl } from "./useCiGuideline";

export function BackToProjectLink({ projectId }: { projectId: string }) {
  return (
    <a href={workPaths.project(projectId)} style={{ fontSize: 13, color: "var(--tool-text-link)" }}>
      ← Back to project
    </a>
  );
}

export function PageEditToggle({
  editMode,
  onToggle,
}: {
  editMode: boolean;
  onToggle: () => void;
}) {
  return (
    <span className={`page-edit-btn${editMode ? " active" : ""}`} onClick={onToggle}>
      {editMode ? "✓ Done" : "✎ Edit"}
    </span>
  );
}

export function ModuleHero({
  eyebrow,
  title,
  blurb,
  editMode,
  onToggleEdit,
}: {
  eyebrow: string;
  title: string;
  blurb: string;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <span
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 400,
            fontSize: 12,
            letterSpacing: ".75px",
            color: "var(--tool-text-link)",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        <span
          style={{
            fontFamily: "var(--font-primary)",
            fontWeight: 600,
            fontSize: 64,
            lineHeight: 1,
            color: "var(--tool-text-primary)",
            letterSpacing: "-3px",
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 14, color: "var(--tool-text-muted)", maxWidth: 560 }}>{blurb}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
        <PageEditToggle editMode={editMode} onToggle={onToggleEdit} />
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  onPencil,
}: {
  children: React.ReactNode;
  onPencil?: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span
        style={{
          fontFamily: "var(--font-primary)",
          fontWeight: 600,
          fontSize: 40,
          lineHeight: "40px",
          letterSpacing: "-1px",
          color: "var(--tool-text-primary)",
        }}
      >
        {children}
      </span>
      {onPencil ? (
        <span className="icon-btn" onClick={onPencil} role="button">
          <PencilIcon />
        </span>
      ) : null}
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--tool-surface-card)",
        borderRadius: "var(--radius-xl)",
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

export function ValuePill({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <span
      className="value-pill"
      style={{
        fontFamily: "var(--font-primary)",
        fontSize: small ? 13 : 16,
        background: "var(--tool-bg-canvas)",
        color: "var(--tool-text-primary)",
        padding: small ? "6px 14px" : "10px 20px",
        borderRadius: "var(--radius-round)",
      }}
    >
      {children}
    </span>
  );
}

export function RowActions({
  onEdit,
  onDup,
  onDelete,
  dragProps,
}: {
  onEdit?: () => void;
  onDup?: () => void;
  onDelete?: () => void;
  dragProps?: React.HTMLAttributes<HTMLSpanElement>;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flex: "none" }}>
      {dragProps ? (
        <span className="icon-btn drag-handle" {...dragProps}>
          <DragIcon />
        </span>
      ) : null}
      {onEdit ? (
        <span className="icon-btn" onClick={onEdit} role="button">
          <PencilIcon />
        </span>
      ) : null}
      {onDup ? (
        <span className="icon-btn" onClick={onDup} role="button">
          <DupIcon />
        </span>
      ) : null}
      {onDelete ? (
        <span className="icon-btn" onClick={onDelete} role="button">
          <TrashIcon />
        </span>
      ) : null}
    </div>
  );
}

export function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 0",
        color: "var(--tool-text-muted)",
        cursor: "pointer",
        borderTop: "1px dashed var(--tool-border-input)",
      }}
    >
      <span style={{ fontSize: 16 }}>+</span>
      <span style={{ fontSize: 14 }}>{label}</span>
    </div>
  );
}

export function DrawerShell({
  title,
  wide,
  onClose,
  children,
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="ci-drawer-overlay" onClick={onClose} />
      <div className={`ci-drawer-panel${wide ? " wide" : ""}`}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-primary)",
              fontWeight: 600,
              fontSize: 22,
              color: "var(--tool-text-primary)",
            }}
          >
            {title}
          </span>
          <span className="icon-btn" style={{ display: "flex" }} onClick={onClose} role="button">
            <CloseIcon />
          </span>
        </div>
        {children}
      </div>
    </>
  );
}

export function DrawerActions({
  onCancel,
  onSave,
  onDelete,
  deleteLabel = "Delete",
}: {
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
      {onDelete ? (
        <span
          onClick={onDelete}
          style={{
            flex: 1,
            textAlign: "center",
            padding: 12,
            borderRadius: "var(--radius-m)",
            border: "1px solid #e0715a",
            color: "#e0715a",
            cursor: "pointer",
          }}
        >
          {deleteLabel}
        </span>
      ) : null}
      <span
        onClick={onCancel}
        style={{
          flex: 1,
          textAlign: "center",
          padding: 12,
          borderRadius: "var(--radius-m)",
          border: "1px solid var(--tool-border-input)",
          color: "var(--tool-text-muted)",
          cursor: "pointer",
        }}
      >
        Cancel
      </span>
      <span
        onClick={onSave}
        style={{
          flex: 1,
          textAlign: "center",
          padding: 12,
          borderRadius: "var(--radius-m)",
          background: "var(--tool-accent-primary)",
          color: "var(--tool-text-primary)",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save
      </span>
    </div>
  );
}

export function ImageWell({
  url,
  guidelineId,
  assets,
  onAddAsset,
  onSelect,
  size = 96,
  label,
}: {
  url?: string;
  guidelineId: string;
  assets: Partial<CIAsset>[];
  onAddAsset: (asset: Partial<CIAsset>) => void;
  onSelect: (asset: Partial<CIAsset>) => void;
  size?: number | string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const height = typeof size === "number" ? size : undefined;
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          width: size,
          height: height ?? size,
          minHeight: typeof size === "string" ? 120 : undefined,
          borderRadius: "var(--radius-m)",
          backgroundImage: url ? `url(${url})` : undefined,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundColor: url ? "transparent" : "var(--tool-bg-canvas)",
          flex: "none",
          border: "1px dashed var(--tool-border-input)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--tool-text-muted)",
          cursor: "pointer",
          boxSizing: "border-box",
        }}
      >
        {url ? null : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <UploadIcon />
            {label ? <span style={{ fontSize: 12 }}>{label}</span> : null}
          </div>
        )}
      </div>
      <AssetPickerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelectAsset={(asset) => {
          onSelect(asset);
          setOpen(false);
        }}
        guidelineId={guidelineId}
        availableAssets={assets}
        onAddAssetRecord={onAddAsset}
      />
    </>
  );
}

export function CopyPromptLink({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      style={{ alignSelf: "flex-end", fontSize: 14, color: "var(--tool-text-link)", cursor: "pointer" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || "");
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text || "";
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

export function assetSrc(assets: Partial<CIAsset>[], id?: string | null) {
  if (!id) return "";
  return assetUrl(assets.find((a) => a.id === id));
}

export function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="toggle-group">
      {options.map((o) => (
        <div
          key={o.value}
          className={`toggle-btn${value === o.value ? " active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </div>
      ))}
    </div>
  );
}
