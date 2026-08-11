/**
 * Split legacy combined CI sections (logo, colors, typography, …)
 * into the 9×52 submodule catalog rows.
 */

import {
  getSubModule,
  type CiSubModuleId,
} from "./modules-catalog";
import { generateUUID, type CIAsset, type CISection, type LegacySectionType } from "./types";

export const LEGACY_SECTION_TYPES: ReadonlySet<string> = new Set([
  "overview",
  "logo",
  "colors",
  "typography",
  "buttons",
  "grid_frames",
  "backgrounds",
  "imagery",
  "voice_tone",
  "applications",
  "dos_donts",
]);

export function needsLegacyMigration(
  sections: Partial<CISection>[]
): boolean {
  return sections.some(
    (s) => s.section_type && LEGACY_SECTION_TYPES.has(s.section_type)
  );
}

type LogoBucket =
  | "primary_logo"
  | "secondary_logo"
  | "tertiary_logo"
  | "wordmark"
  | "image_mark"
  | "clear_space"
  | "misc_logo";

type VariantItem = {
  id: string;
  assetId: string;
  label: string;
  stage?: string;
  fit?: string;
};

export type MigratedGuideline = {
  sections: Partial<CISection>[];
  /** assetId → new section id (rebind references; never delete assets) */
  assetSectionMap: Record<string, string>;
  deletedSectionIds: string[];
};

function classifyLogoLabel(label: string): LogoBucket {
  const l = (label || "").toLowerCase();
  if (/clear\s*space|exclusion|clearspace/.test(l)) return "clear_space";
  if (/word\s*mark|wordmark/.test(l)) return "wordmark";
  if (/image\s*mark|bildmarke|symbol|icon\s*mark/.test(l)) return "image_mark";
  if (/tertiary/.test(l)) return "tertiary_logo";
  if (/secondary/.test(l)) return "secondary_logo";
  if (/primary/.test(l)) return "primary_logo";
  if (/logo\s*system|logo\s*variants|container/.test(l)) return "misc_logo";
  if (/^logo$/.test(l.trim()) || /munich-startup-logo/.test(l)) return "misc_logo";
  return "misc_logo";
}

function makeSection(opts: {
  guidelineId: string;
  sectionType: CiSubModuleId | string;
  position: number;
  data: Record<string, unknown>;
  headline?: string | null;
  description?: string | null;
  eyebrow?: string | null;
}): Partial<CISection> {
  const def = getSubModule(opts.sectionType);
  return {
    id: generateUUID(),
    guideline_id: opts.guidelineId,
    section_type: opts.sectionType as CISection["section_type"],
    position: opts.position,
    eyebrow_label: opts.eyebrow ?? def?.eyebrow ?? null,
    headline: opts.headline ?? def?.defaultHeadline ?? null,
    headline_emphasis: null,
    description: opts.description ?? null,
    is_visible: true,
    data: opts.data,
  };
}

function slotFromVariants(
  items: VariantItem[],
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const first = items[0];
  if (!first) return { assetId: "", label: "", stage: "light", ...(extra || {}) };
  return {
    assetId: first.assetId || "",
    label: first.label || "",
    stage: first.stage || "light",
    fit: first.fit || "contain",
    variants: items,
    ...(extra || {}),
  };
}

function bindAssets(
  map: Record<string, string>,
  sectionId: string,
  items: { assetId?: string }[]
) {
  for (const item of items) {
    if (item.assetId) map[item.assetId] = sectionId;
  }
}

/**
 * Pure transform: legacy sections → catalog submodules.
 * Non-legacy sections are kept as-is (re-positioned after migrated ones).
 */
export function migrateLegacySections(
  guidelineId: string,
  sections: Partial<CISection>[],
  _assets: Partial<CIAsset>[] = []
): MigratedGuideline {
  const legacy = sections.filter(
    (s) => s.section_type && LEGACY_SECTION_TYPES.has(s.section_type)
  );
  const keep = sections.filter(
    (s) => !s.section_type || !LEGACY_SECTION_TYPES.has(s.section_type)
  );

  if (legacy.length === 0) {
    return {
      sections,
      assetSectionMap: {},
      deletedSectionIds: [],
    };
  }

  const out: Partial<CISection>[] = [];
  const assetSectionMap: Record<string, string> = {};
  let position = 0;

  const push = (sec: Partial<CISection>) => {
    out.push({ ...sec, position });
    position += 1;
  };

  // --- Logo ---
  for (const sec of legacy.filter((s) => s.section_type === "logo")) {
    const logos: any[] = sec.data?.logos || [];
    const buckets = new Map<LogoBucket, VariantItem[]>();
    for (const logo of logos) {
      const bucket = classifyLogoLabel(String(logo.label || ""));
      const list = buckets.get(bucket) || [];
      list.push({
        id: logo.id || generateUUID(),
        assetId: logo.assetId || "",
        label: logo.label || bucket,
        stage: logo.stage,
        fit: logo.fit,
      });
      buckets.set(bucket, list);
    }

    const order: LogoBucket[] = [
      "primary_logo",
      "secondary_logo",
      "tertiary_logo",
      "wordmark",
      "image_mark",
      "clear_space",
      "misc_logo",
    ];

    for (const bucket of order) {
      const items = buckets.get(bucket);
      if (!items?.length) continue;
      const data =
        bucket === "clear_space"
          ? {
              ...slotFromVariants(items, {
                notes: sec.data?.clearspaceText || "",
                multiplier: 1.5,
              }),
              assetId: items[0].assetId || sec.data?.clearspaceAssetId || "",
            }
          : slotFromVariants(items);

      const created = makeSection({
        guidelineId,
        sectionType: bucket,
        position,
        data,
        description: sec.description,
        headline:
          bucket === "primary_logo"
            ? sec.headline || getSubModule(bucket)?.defaultHeadline
            : getSubModule(bucket)?.defaultHeadline,
      });
      push(created);
      if (created.id) bindAssets(assetSectionMap, created.id, items);
      if (bucket === "clear_space" && sec.data?.clearspaceAssetId && created.id) {
        assetSectionMap[sec.data.clearspaceAssetId] = created.id;
      }
    }

    const minSizes: any[] = sec.data?.minSizes || [];
    if (minSizes.length > 0) {
      const clear = out.find((s) => s.section_type === "clear_space");
      const notes = [
        (clear?.data as any)?.notes || sec.data?.clearspaceText || "",
        ...minSizes.map(
          (m: any) =>
            `Min size (${m.useCase || "general"}): ${m.size || ""}${m.unit || ""}`
        ),
      ]
        .filter(Boolean)
        .join("\n");
      if (clear?.data) {
        clear.data = { ...clear.data, notes };
      } else {
        push(
          makeSection({
            guidelineId,
            sectionType: "clear_space",
            position,
            data: { multiplier: 1.5, assetId: "", notes },
          })
        );
      }
    }
  }

  // --- Colors ---
  for (const sec of legacy.filter((s) => s.section_type === "colors")) {
    const groups: any[] = sec.data?.groups || [];
    const targets: { type: CiSubModuleId; match: RegExp }[] = [
      { type: "color_primary", match: /primary|detected|brand/i },
      { type: "color_secondary", match: /secondary/i },
      { type: "color_accent", match: /accent/i },
      { type: "functional", match: /functional|neutral|gray|grey|system/i },
    ];
    const used = new Set<string>();

    for (const group of groups) {
      const label = String(group.groupLabel || "");
      const swatches = (group.swatches || []).map((s: any) => ({
        id: s.id || generateUUID(),
        name: s.name || "",
        hex: s.hex || "#000000",
        cssVar: s.cssVar,
        rgb: s.rgb,
        cmyk: s.cmyk,
      }));

      let type: CiSubModuleId = "color_primary";
      const hit = targets.find((t) => t.match.test(label) && !used.has(t.type));
      if (hit) {
        type = hit.type;
        used.add(type);
      } else if (!used.has("color_primary")) {
        type = "color_primary";
        used.add(type);
      } else if (!used.has("color_secondary")) {
        type = "color_secondary";
        used.add(type);
      } else if (!used.has("color_accent")) {
        type = "color_accent";
        used.add(type);
      } else {
        type = "functional";
        used.add(type);
      }

      // Skip completely empty duplicate groups if we already have that type with data
      const existing = out.find((s) => s.section_type === type);
      if (existing) {
        const prev = (existing.data?.swatches as any[]) || [];
        existing.data = { swatches: [...prev, ...swatches] };
        continue;
      }

      push(
        makeSection({
          guidelineId,
          sectionType: type,
          position,
          data: { swatches },
          headline: group.groupLabel || getSubModule(type)?.defaultHeadline,
          description: sec.description,
        })
      );
    }

    if (groups.length === 0) {
      push(
        makeSection({
          guidelineId,
          sectionType: "color_primary",
          position,
          data: { swatches: [] },
          description: sec.description,
        })
      );
    }
  }

  // --- Typography ---
  for (const sec of legacy.filter((s) => s.section_type === "typography")) {
    const rows: any[] = sec.data?.rows || [];
    const scale: any[] = sec.data?.scale || [];

    const typeMap: { type: CiSubModuleId; match: RegExp }[] = [
      { type: "headline_primary", match: /h1|display|hero|headline.?1|primary/i },
      { type: "headline_secondary", match: /h2|headline.?2|secondary/i },
      { type: "headline_tertiary", match: /h3|headline.?3|tertiary/i },
      { type: "body", match: /body|paragraph|copy/i },
      { type: "caption", match: /caption|small|label|meta/i },
    ];
    const usedTypes = new Set<string>();

    for (const row of rows) {
      const label = String(row.label || "");
      const hit = typeMap.find((t) => t.match.test(label) && !usedTypes.has(t.type));
      const type = hit?.type || (!usedTypes.has("body") ? "body" : "caption");
      usedTypes.add(type);
      if (out.some((s) => s.section_type === type)) continue;

      push(
        makeSection({
          guidelineId,
          sectionType: type,
          position,
          data: {
            fontFamily: row.fontFamily || "",
            fontWeight: row.fontWeight || "",
            fontSize: row.fontSize || "",
            lineHeight: row.lineHeight || "",
            letterSpacing: "",
            sampleText: row.sampleText || "The quick brown fox",
            specLine1: row.specLine1 || "",
          },
          headline: row.label || getSubModule(type)?.defaultHeadline,
          description: sec.description,
        })
      );
    }

    if (scale.length > 0) {
      push(
        makeSection({
          guidelineId,
          sectionType: "typography_scale",
          position,
          data: {
            scale: scale.map((s: any) => ({
              id: s.id || generateUUID(),
              token: s.token || `text-${s.px}`,
              value: s.value || (s.px != null ? `${s.px}px` : ""),
            })),
          },
          description: sec.description,
        })
      );
    }
  }

  // --- Buttons ---
  for (const sec of legacy.filter((s) => s.section_type === "buttons")) {
    const samples: any[] = sec.data?.samples || [];
    for (const sample of samples) {
      const variant = String(sample.variant || "primary").toLowerCase();
      let type: CiSubModuleId = "ui_primary";
      if (/secondary/.test(variant)) type = "ui_secondary";
      else if (/tertiary|ghost|tab/.test(variant)) type = "ui_tertiary";
      else if (/primary/.test(variant)) type = "ui_primary";

      if (out.some((s) => s.section_type === type)) continue;

      const colors = sample.defaultColors || {};
      push(
        makeSection({
          guidelineId,
          sectionType: type,
          position,
          data: {
            assetId: "",
            label: sample.label || "Button",
            bg: colors.bg || "",
            text: colors.text || "",
            border: colors.border || "",
            radius: "",
            padding: "",
            hover: sample.hoverColors || {},
            active: sample.activeColors || {},
          },
          description: sec.description,
        })
      );
    }
  }

  // --- Applications + dos_donts → misuse / deck ---
  const misuseItems: {
    id: string;
    type: "do" | "dont";
    assetId: string;
    caption: string;
  }[] = [];
  const deckSlides: { id: string; label: string; assetId: string }[] = [];

  for (const sec of legacy.filter((s) => s.section_type === "dos_donts")) {
    for (const item of sec.data?.items || []) {
      misuseItems.push({
        id: item.id || generateUUID(),
        type: item.type === "dont" ? "dont" : "do",
        assetId: item.assetId || "",
        caption: item.caption || "",
      });
    }
  }

  for (const sec of legacy.filter((s) => s.section_type === "applications")) {
    for (const app of sec.data?.apps || []) {
      const label = String(app.label || "");
      if (/misuse|don'?t|incorrect/i.test(label)) {
        misuseItems.push({
          id: app.id || generateUUID(),
          type: "dont",
          assetId: app.assetId || "",
          caption: label,
        });
      } else {
        deckSlides.push({
          id: app.id || generateUUID(),
          label: label || "Application",
          assetId: app.assetId || "",
        });
      }
    }
  }

  if (misuseItems.length > 0) {
    const created = makeSection({
      guidelineId,
      sectionType: "misuse_examples",
      position,
      data: { items: misuseItems },
    });
    push(created);
    if (created.id) bindAssets(assetSectionMap, created.id, misuseItems);
  }

  // --- Grid frames ---
  for (const sec of legacy.filter((s) => s.section_type === "grid_frames")) {
    const frames: any[] = sec.data?.frames || [];
    const social45: VariantItem[] = [];
    const social916: VariantItem[] = [];
    const containers: VariantItem[] = [];
    const otherFrames: { id: string; label: string; assetId: string }[] = [];

    for (const frame of frames) {
      const ar = String(frame.aspectRatio || frame.sublabel || "");
      const label = String(frame.label || "");
      const item: VariantItem = {
        id: frame.id || generateUUID(),
        assetId: frame.assetId || "",
        label: label || ar,
      };

      if (/4\s*[:/x]\s*5|4:5/.test(ar) || /4\s*[:/x]\s*5/.test(label)) {
        social45.push(item);
      } else if (/9\s*[:/x]\s*16|9:16/.test(ar) || /stories|reels/i.test(label)) {
        social916.push(item);
      } else if (/container|card|modal/i.test(label)) {
        containers.push(item);
      } else {
        otherFrames.push({
          id: item.id,
          label: `${label}${ar ? ` (${ar})` : ""}`,
          assetId: item.assetId,
        });
      }
    }

    if (social45.length) {
      const created = makeSection({
        guidelineId,
        sectionType: "social_4x5",
        position,
        data: slotFromVariants(social45, { aspectRatio: "4:5" }),
      });
      push(created);
      if (created.id) bindAssets(assetSectionMap, created.id, social45);
    }
    if (social916.length) {
      const created = makeSection({
        guidelineId,
        sectionType: "social_9x16",
        position,
        data: slotFromVariants(social916, { aspectRatio: "9:16" }),
      });
      push(created);
      if (created.id) bindAssets(assetSectionMap, created.id, social916);
    }
    if (containers.length) {
      const created = makeSection({
        guidelineId,
        sectionType: "layout_containers",
        position,
        data: slotFromVariants(containers),
      });
      push(created);
      if (created.id) bindAssets(assetSectionMap, created.id, containers);
    }

    deckSlides.push(...otherFrames);
  }

  if (deckSlides.length > 0) {
    const created = makeSection({
      guidelineId,
      sectionType: "presentation_deck",
      position,
      data: { slides: deckSlides },
    });
    push(created);
    if (created.id) bindAssets(assetSectionMap, created.id, deckSlides);
  }

  // --- Other legacy (overview, voice, imagery, backgrounds) ---
  for (const sec of legacy) {
    const t = sec.section_type as LegacySectionType;
    if (
      t === "logo" ||
      t === "colors" ||
      t === "typography" ||
      t === "buttons" ||
      t === "applications" ||
      t === "dos_donts" ||
      t === "grid_frames"
    ) {
      continue;
    }

    if (t === "overview") {
      push(
        makeSection({
          guidelineId,
          sectionType: "mission",
          position,
          data: { body: sec.description || sec.data?.body || "" },
          headline: sec.headline,
          description: sec.description,
        })
      );
    } else if (t === "voice_tone") {
      push(
        makeSection({
          guidelineId,
          sectionType: "tone_matrix",
          position,
          data: sec.data || {
            axes: [
              { id: "formal_casual", left: "Formal", right: "Casual", value: 50 },
              {
                id: "punchy_detailed",
                left: "Punchy",
                right: "Detailed",
                value: 50,
              },
            ],
          },
          headline: sec.headline,
          description: sec.description,
        })
      );
    } else if (t === "imagery") {
      push(
        makeSection({
          guidelineId,
          sectionType: "photography_style",
          position,
          data: sec.data || { dos: [], donts: [] },
          headline: sec.headline,
          description: sec.description,
        })
      );
    } else if (t === "backgrounds") {
      if (!out.some((s) => s.section_type === "layout_containers")) {
        push(
          makeSection({
            guidelineId,
            sectionType: "layout_containers",
            position,
            data: sec.data || { bg: "", assetId: "" },
            headline: sec.headline || "Backgrounds",
            description: sec.description,
          })
        );
      }
    }
  }

  // Keep existing non-legacy sections
  for (const sec of keep) {
    push({ ...sec, position });
  }

  const deletedSectionIds = legacy
    .map((s) => s.id)
    .filter((id): id is string => Boolean(id));

  return { sections: out, assetSectionMap, deletedSectionIds };
}
