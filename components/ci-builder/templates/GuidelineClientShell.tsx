"use client";

import React, { useMemo } from "react";
import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";
import {
  buildGuidelineViewModel,
  resolveClientTemplate,
} from "@/lib/ci-builder/view-model";
import { GreenpointLayout } from "@/components/ci-builder/templates/GreenpointLayout";
import { FoundryLayout } from "@/components/ci-builder/templates/FoundryLayout";
import { MultipageLayout } from "@/components/ci-builder/templates/MultipageLayout";

export function GuidelineClientShell({
  brandName,
  theme,
  sections,
  assets,
  mode = "standalone",
  slug,
  initialModuleId,
  toolbar,
  /** Canvas admin View uses `full` so every Edit element appears in presentation. */
  visibility = "client",
}: {
  brandName: string;
  theme: CITheme;
  sections: Partial<CISection>[];
  assets: Partial<CIAsset>[];
  mode?: "portal" | "standalone";
  slug?: string;
  initialModuleId?: string | null;
  toolbar?: React.ReactNode;
  visibility?: "client" | "full";
}) {
  const viewModel = useMemo(
    () => buildGuidelineViewModel({ brandName, theme, sections, assets, visibility }),
    [brandName, theme, sections, assets, visibility]
  );
  const template = resolveClientTemplate(theme);
  const shared = {
    viewModel,
    mode,
    slug,
    initialModuleId: initialModuleId || null,
    toolbar,
  };
  if (template === "foundry") return <FoundryLayout {...shared} />;
  if (template === "multipage") return <MultipageLayout {...shared} />;
  return <GreenpointLayout {...shared} />;
}
