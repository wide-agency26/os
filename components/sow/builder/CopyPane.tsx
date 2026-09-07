"use client";

import { Plus, Trash2 } from "lucide-react";
import type { SowDocument, SowSection } from "@/lib/sow/types";
import type { SowSuggestion } from "@/lib/sow/assist";
import { suggestionFor } from "@/lib/sow/assist";
import { SuggestField } from "./SuggestField";
import { scopePrice } from "./ScopeList";
import { formatSowMoney } from "@/lib/sow/constants";

export function CopyPane({
  sow,
  section,
  mode,
  suggestions,
  pending,
  onIntro,
  onConservative,
  onSectionTitle,
  onSectionDesc,
  onItemChange,
  onItemBlur,
  onAddItem,
  onDeleteItem,
  onAccept,
  onSkip,
  onRewrite,
}: {
  sow: SowDocument;
  section: SowSection | null;
  mode: "hero" | "section";
  suggestions: SowSuggestion[];
  pending: boolean;
  onIntro: (v: string, save?: boolean) => void;
  onConservative: (v: string, save?: boolean) => void;
  onSectionTitle: (v: string, save?: boolean) => void;
  onSectionDesc: (v: string, save?: boolean) => void;
  onItemChange: (itemId: string, patch: { title?: string; description?: string }) => void;
  onItemBlur: (itemId: string) => void;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
  onAccept: (field: string, text: string) => void;
  onSkip: (field: string) => void;
  onRewrite: (field: string, current: string, mode: "rewrite" | "shorter" | "template") => void;
}) {
  if (mode === "hero") {
    return (
      <div className="p-4 space-y-5 overflow-y-auto h-full min-w-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Hero copy</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            What the client reads under the title. Generate from context, then accept.
          </p>
        </div>
        <SuggestField
          label="Intro narrative"
          field="intro_narrative"
          value={sow.intro_narrative || ""}
          suggestion={suggestionFor(suggestions, "intro_narrative")}
          multiline
          pending={pending}
          onChange={(v) => onIntro(v)}
          onBlur={() => onIntro(sow.intro_narrative || "", true)}
          onAccept={onAccept}
          onSkip={onSkip}
          onRewrite={onRewrite}
        />
        <SuggestField
          label="Conservative scope"
          field="conservative_body"
          value={sow.conservative_body}
          suggestion={suggestionFor(suggestions, "conservative_body")}
          multiline
          pending={pending}
          onChange={(v) => onConservative(v)}
          onBlur={() => onConservative(sow.conservative_body, true)}
          onAccept={onAccept}
          onSkip={onSkip}
          onRewrite={onRewrite}
        />
      </div>
    );
  }

  if (!section) {
    return (
      <div className="p-6 text-sm text-gray-500 min-w-0">Select a scope on the left.</div>
    );
  }

  const price = scopePrice(sow, section);

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Scope copy
          </p>
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {section.title}
          </h2>
        </div>
        <p className="text-sm font-semibold text-gray-900 shrink-0">
          {price != null ? formatSowMoney(price, sow.currency) : "Unpriced"}
        </p>
      </div>

      <SuggestField
        label="Scope title"
        field={`section:${section.id}:title`}
        value={section.title}
        suggestion={suggestionFor(suggestions, `section:${section.id}:title`)}
        pending={pending}
        onChange={(v) => onSectionTitle(v)}
        onBlur={() => onSectionTitle(section.title, true)}
        onAccept={onAccept}
        onSkip={onSkip}
        onRewrite={onRewrite}
      />
      <SuggestField
        label="Scope description"
        field={`section:${section.id}:description`}
        value={section.service_description_snapshot || section.intro || ""}
        suggestion={suggestionFor(
          suggestions,
          `section:${section.id}:description`
        )}
        multiline
        pending={pending}
        onChange={(v) => onSectionDesc(v)}
        onBlur={() =>
          onSectionDesc(section.service_description_snapshot || section.intro || "", true)
        }
        onAccept={onAccept}
        onSkip={onSkip}
        onRewrite={onRewrite}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
            Deliverables
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700"
            onClick={onAddItem}
          >
            <Plus size={12} /> Add
          </button>
        </div>
        {section.line_items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-gray-200 p-3 space-y-2"
          >
            <div className="flex justify-end">
              <button
                type="button"
                className="text-gray-400 hover:text-red-600"
                onClick={() => onDeleteItem(item.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <SuggestField
              label="Title"
              field={`item:${item.id}:title`}
              value={item.title}
              suggestion={suggestionFor(suggestions, `item:${item.id}:title`)}
              pending={pending}
              onChange={(v) => onItemChange(item.id, { title: v })}
              onBlur={() => onItemBlur(item.id)}
              onAccept={onAccept}
              onSkip={onSkip}
              onRewrite={onRewrite}
            />
            <SuggestField
              label="Description"
              field={`item:${item.id}:description`}
              value={item.description || ""}
              suggestion={suggestionFor(suggestions, `item:${item.id}:description`)}
              multiline
              pending={pending}
              onChange={(v) => onItemChange(item.id, { description: v })}
              onBlur={() => onItemBlur(item.id)}
              onAccept={onAccept}
              onSkip={onSkip}
              onRewrite={onRewrite}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
