import type { CISection, CITheme } from "@/lib/ci-builder/types";
import {
  mergeSameHueAccentsIntoPrimary,
  rebalanceColorBuckets,
} from "@/lib/ci-builder/color-families";
import { applyCatalogCopy } from "@/lib/ci-builder/section-copy";
import { hydrateTypeSpecsFromTheme } from "@/lib/ci-builder/hydrate-type-specs";

/** Replace Figma import blurbs and rebalance Primary overflow into Secondary. */
export function polishClientFacingSections(
  sections: Partial<CISection>[],
  opts?: { guidelineId?: string | null; theme?: CITheme | null }
): { sections: Partial<CISection>[]; changed: boolean } {
  const copied = applyCatalogCopy(sections, opts);
  const merged = mergeSameHueAccentsIntoPrimary(copied.sections);
  const rebalanced = rebalanceColorBuckets(merged.sections);
  const typed = hydrateTypeSpecsFromTheme(rebalanced.sections, opts?.theme);
  return {
    sections: typed.sections,
    changed: copied.changed || merged.changed || rebalanced.changed || typed.changed,
  };
}
