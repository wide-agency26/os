"use client";

import { useEffect } from "react";
import type { CIAsset, CISection, CITheme } from "@/lib/ci-builder/types";
import {
  buildFontLoadPlan,
  checkNamedFontLoaded,
  namedThemeFonts,
} from "@/lib/ci-builder/load-fonts";

export function CiFontLoader({
  theme,
  assets,
  sections,
  onStatus,
}: {
  theme?: CITheme | null;
  assets?: Partial<CIAsset>[] | null;
  sections?: Partial<CISection>[] | null;
  onStatus?: (loaded: boolean | null) => void;
}) {
  const plan = buildFontLoadPlan(theme, assets, sections);

  useEffect(() => {
    let cancelled = false;
    const named = namedThemeFonts(theme);
    const faceNodes: HTMLElement[] = [];

    const run = async () => {
      if (plan.googleHref) {
        let link = document.head.querySelector(
          `link[data-ci-font="google"][href="${plan.googleHref}"]`
        ) as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = plan.googleHref;
          link.setAttribute("data-ci-font", "google");
          document.head.appendChild(link);
        }
        await new Promise<void>((resolve) => {
          if (!link) {
            resolve();
            return;
          }
          const done = () => resolve();
          link.addEventListener("load", done, { once: true });
          link.addEventListener("error", done, { once: true });
          setTimeout(done, 4000);
        });
      }
      if (plan.faceCss) {
        const prev = document.head.querySelector('style[data-ci-font="face"]');
        prev?.remove();
        const style = document.createElement("style");
        style.setAttribute("data-ci-font", "face");
        style.textContent = plan.faceCss;
        document.head.appendChild(style);
        faceNodes.push(style);
      }
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      if (!named.length) {
        if (!cancelled) onStatus?.(null);
        return;
      }
      const ok = await checkNamedFontLoaded(named[0]);
      if (!cancelled) onStatus?.(ok);
    };

    void run();
    return () => {
      cancelled = true;
      faceNodes.forEach((n) => n.remove());
    };
  }, [theme, plan.googleHref, plan.faceCss, onStatus]);

  return null;
}
