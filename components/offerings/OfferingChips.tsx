"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { setDealOfferings } from "@/app/actions/offerings";
import { OfferingPicker, useCatalogOfferings } from "@/components/offerings/OfferingPicker";
import { resolveOfferingChips } from "@/lib/offerings/normalize";
import type { OfferingChip, OfferingInput } from "@/lib/offerings/types";

function Chip({
  chip,
  editable,
  onRemove,
}: {
  chip: OfferingChip;
  editable: boolean;
  onRemove?: () => void;
}) {
  const isPkg = chip.kind === "package";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-tight ${
        isPkg
          ? "bg-accent text-white"
          : "border border-border bg-surface-raised text-text-secondary"
      }`}
    >
      {chip.name}
      {editable ? (
        <button
          type="button"
          aria-label={`Remove ${chip.name}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove?.();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={`rounded-sm ${
            isPkg ? "hover:bg-white/15" : "hover:bg-surface hover:text-text-primary"
          }`}
        >
          <X size={10} strokeWidth={2.25} />
        </button>
      ) : null}
    </span>
  );
}

export function OfferingChips({
  value = [],
  projectId,
  bdRecordId,
  editable = true,
  compact = false,
  persist = true,
  onChanged,
}: {
  value?: OfferingChip[];
  projectId?: string | null;
  bdRecordId?: string | null;
  editable?: boolean;
  compact?: boolean;
  persist?: boolean;
  onChanged?: (next: OfferingChip[]) => void;
}) {
  const catalog = useCatalogOfferings();
  const [chips, setChips] = useState<OfferingChip[]>(value);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const valueKey = value.map((v) => `${v.kind}:${v.catalogId}`).join(",");
  useEffect(() => {
    setChips(value);
    // Sync when the server list actually changes, not on new array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const width = Math.min(360, Math.max(280, window.innerWidth - 24));
      let left = r.left;
      if (left + width > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - width - 12);
      }
      let top = r.bottom + 8;
      const approxH = Math.min(480, window.innerHeight * 0.7);
      if (top + approxH > window.innerHeight - 12) {
        top = Math.max(12, r.top - approxH - 8);
      }
      setPos({ top, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(nextInputs: OfferingInput[], nextChips?: OfferingChip[]) {
    const optimistic =
      nextChips ??
      (catalog
        ? resolveOfferingChips(nextInputs, catalog)
        : nextInputs.map((item) => {
            const existing = chips.find(
              (c) => c.kind === item.kind && c.catalogId === item.catalogId
            );
            return existing ?? { ...item, name: "…" };
          }));
    const prev = chips;
    setChips(optimistic);
    onChanged?.(optimistic);
    if (!persist) return;
    if (!projectId && !bdRecordId) return;
    setPending(true);
    void (async () => {
      try {
        const res = await setDealOfferings({
          projectId,
          bdRecordId,
          items: nextInputs,
        });
        if (!res.ok) {
          setChips(prev);
          onChanged?.(prev);
          return;
        }
        if (res.chips) {
          setChips(res.chips);
          onChanged?.(res.chips);
        }
      } catch {
        setChips(prev);
        onChanged?.(prev);
      } finally {
        setPending(false);
      }
    })();
  }

  function removeChip(chip: OfferingChip) {
    const next = chips.filter(
      (c) => !(c.kind === chip.kind && c.catalogId === chip.catalogId)
    );
    commit(
      next.map((c) => ({ kind: c.kind, catalogId: c.catalogId })),
      next
    );
  }

  const canEdit = editable && (persist ? Boolean(projectId || bdRecordId) : true);

  return (
    <div
      data-no-card-drag
      data-offerings
      className={`flex flex-wrap items-center gap-1 ${compact ? "" : "gap-1.5"}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {chips.map((chip) => (
        <Chip
          key={`${chip.kind}:${chip.catalogId}`}
          chip={chip}
          editable={canEdit}
          onRemove={() => removeChip(chip)}
        />
      ))}
      {canEdit ? (
        <button
          ref={btnRef}
          type="button"
          disabled={pending}
          aria-label="Add package or service"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-dashed border-border text-text-muted hover:border-text-muted hover:text-text-primary disabled:opacity-50"
        >
          <Plus size={11} strokeWidth={2.25} />
        </button>
      ) : chips.length === 0 ? (
        <span className="text-[10px] text-text-muted">No offerings</span>
      ) : null}

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Packages and services"
              className="fixed z-[80] rounded-lg border border-border bg-surface shadow-lg p-3 max-h-[70vh] overflow-y-auto"
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <OfferingPicker
                value={chips}
                onChange={(next) => {
                  commit(next);
                }}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
