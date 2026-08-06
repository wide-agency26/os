import type { FigmaFileResponse } from "@/lib/ci-builder/figma/client";
import { matchSectionType } from "@/lib/ci-builder/glossary";
import { generateUUID } from "@/lib/ci-builder/types";
import type { CISection, ButtonSample, StateColors } from "@/lib/ci-builder/types";
import { ensureSection, walkNodes, aspectRatioLabel, makePendingAsset, type PendingExport } from "./helpers";
import { figmaColorToHex } from "@/lib/ci-builder/figma/client";

function solidFillHex(node: any): string | undefined {
  const fill = (node.fills || []).find(
    (f: any) => f?.type === "SOLID" && f.visible !== false && f.color
  );
  return fill?.color ? figmaColorToHex(fill.color) : undefined;
}

function solidStrokeHex(node: any): string | undefined {
  const stroke = (node.strokes || []).find(
    (f: any) => f?.type === "SOLID" && f.visible !== false && f.color
  );
  return stroke?.color ? figmaColorToHex(stroke.color) : undefined;
}

function textColorHex(node: any): string | undefined {
  let found: string | undefined;
  walkNodes(node, (n) => {
    if (found || n.type !== "TEXT") return;
    found = solidFillHex(n);
  });
  return found;
}

export function normalizeButtons(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
}): { sampleCount: number } {
  const { file, sections } = opts;
  const btnSec = ensureSection(sections, "buttons", file.name);
  if (!btnSec.data.samples) btnSec.data.samples = [];
  const samples: ButtonSample[] = btnSec.data.samples;

  const buttonNodes: any[] = [];
  walkNodes(file.document, (n) => {
    if (n.type !== "COMPONENT" && n.type !== "INSTANCE" && n.type !== "FRAME") return;
    const name = n.name || "";
    if (!/button|btn|cta|knopf/i.test(name)) return;
    // Prefer COMPONENT / COMPONENT_SET children
    if (n.type === "FRAME" && !matchSectionType(name).type) {
      // only take frames explicitly named button*
      if (!/^button|^btn/i.test(name.split(/[/\-_ ]/)[0] || "")) return;
    }
    buttonNodes.push(n);
  });

  // Also component sets named Button
  for (const [id, set] of Object.entries(file.componentSets || {})) {
    if (!/button|btn/i.test(set.name)) continue;
    walkNodes(file.document, (n) => {
      if (n.id === id || (n.type === "COMPONENT_SET" && n.name === set.name)) {
        buttonNodes.push(n);
      }
    });
  }

  const byVariant = new Map<string, any[]>();
  for (const n of buttonNodes) {
    const base =
      n.name?.split("=")[0]?.split("/")[0]?.trim() ||
      n.name?.replace(/\s*(hover|pressed|active|default|disabled).*/i, "").trim() ||
      "Button";
    const list = byVariant.get(base) || [];
    list.push(n);
    byVariant.set(base, list);
  }

  for (const [variantName, nodes] of byVariant) {
    if (samples.length >= 12) break;
    const def =
      nodes.find((n) => /default|=default|idle/i.test(n.name)) || nodes[0];
    const hover = nodes.find((n) => /hover/i.test(n.name));
    const active = nodes.find((n) => /active|pressed|click/i.test(n.name));

    const toState = (n: any | undefined): StateColors | undefined => {
      if (!n) return undefined;
      return {
        bg: solidFillHex(n),
        text: textColorHex(n) || "#ffffff",
        border: solidStrokeHex(n),
      };
    };

    const variantKey = /secondary|outline|ghost|tab/i.test(variantName)
      ? /ghost/i.test(variantName)
        ? "ghost"
        : /tab/i.test(variantName)
          ? "tab"
          : "secondary"
      : "primary";

    if (samples.some((s) => s.label === variantName)) continue;

    samples.push({
      id: generateUUID(),
      variant: variantKey,
      label: variantName.slice(0, 40) || "Button",
      size: "md",
      defaultColors: toState(def),
      hoverColors: toState(hover),
      activeColors: toState(active),
    });
  }

  return { sampleCount: samples.length };
}

export function collectVisualPendings(opts: {
  file: FigmaFileResponse;
  sections: Partial<CISection>[];
}): { pendings: PendingExport[]; assigned: number; unassigned: number } {
  const { file, sections } = opts;
  const pendings: PendingExport[] = [];
  let assigned = 0;
  let unassigned = 0;

  const candidates: { id: string; name: string; type: string; box?: any }[] = [];
  walkNodes(file.document, (n) => {
    if (!["FRAME", "COMPONENT", "COMPONENT_SET", "GROUP", "SECTION"].includes(n.type)) {
      return;
    }
    // Skip tiny utility nodes
    const w = n.absoluteBoundingBox?.width || 0;
    const h = n.absoluteBoundingBox?.height || 0;
    if (w > 0 && h > 0 && w < 24 && h < 24) return;
    candidates.push({
      id: n.id,
      name: n.name,
      type: n.type,
      box: n.absoluteBoundingBox,
    });
  });

  for (const c of candidates) {
    const name = c.name;
    const lower = name.toLowerCase();

    // Do / Don't pairing
    const isDo = /(?:^|[/\-_\s])(do|does|correct|richtig|erlaubt)(?:$|[/\-_\s])/i.test(name) &&
      !/dont|don't|doesn't|falsch|verboten/i.test(name);
    const isDont =
      /dont|don't|do-not|incorrect|falsch|verboten|wrong/i.test(name);

    if (isDo || isDont) {
      const sec = ensureSection(sections, "dos_donts", file.name);
      const assetId = generateUUID();
      pendings.push({
        nodeId: c.id,
        label: name,
        sectionType: "dos_donts",
        kind: "dos_donts",
        assetId,
        caption: name,
        doDont: isDo ? "do" : "dont",
      });
      if (!sec.data.items) sec.data.items = [];
      sec.data.items.push({
        id: generateUUID(),
        type: isDo ? "do" : "dont",
        assetId,
        caption: name.replace(/^(do|dont|don't)[/\-_\s]*/i, "").trim() || name,
      });
      assigned++;
      continue;
    }

    const match = matchSectionType(name);
    const section = match.type;

    if (!section || ["overview", "imagery", "voice_tone", "colors", "typography", "buttons"].includes(section)) {
      // Unmapped visual — keep for AI / queue if looks like an asset
      if (/logo|mockup|poster|banner|bg|background|pattern|texture|frame|grid|app|device|phone|desktop/i.test(lower)) {
        const assetId = generateUUID();
        pendings.push({
          nodeId: c.id,
          label: name,
          sectionType: "unmatched",
          kind: "unmatched",
          assetId,
        });
        unassigned++;
      }
      continue;
    }

    const assetId = generateUUID();
    const sec = ensureSection(sections, section, file.name);

    if (section === "logo") {
      const stage: "dark" | "light" | "any" = /dark|inverse|white|negativ/i.test(lower)
        ? "dark"
        : /light|positiv|black on white/i.test(lower)
          ? "light"
          : "any";
      pendings.push({
        nodeId: c.id,
        label: name,
        sectionType: "logo",
        kind: "logo",
        assetId,
        preferSvg: true,
        stage,
      });
      if (!sec.data.logos) sec.data.logos = [];
      sec.data.logos.push({
        id: generateUUID(),
        assetId,
        label: name.split("/").pop() || name,
        subtitle: stage !== "any" ? `${stage} background` : undefined,
        stage,
        fit: "contain",
      });
      assigned++;
    } else if (section === "backgrounds") {
      const groupLabel =
        name.split("/")[1]?.trim() ||
        (/pattern|texture/i.test(lower) ? "Patterns" : "Backgrounds");
      pendings.push({
        nodeId: c.id,
        label: name,
        sectionType: "backgrounds",
        kind: "backgrounds",
        assetId,
        groupLabel,
      });
      if (!sec.data.groups) sec.data.groups = [];
      let group = sec.data.groups.find((g: any) => g.groupLabel === groupLabel);
      if (!group) {
        group = { id: generateUUID(), groupLabel, assets: [] };
        sec.data.groups.push(group);
      }
      group.assets.push({ id: generateUUID(), assetId, label: name.split("/").pop() });
      assigned++;
    } else if (section === "grid_frames") {
      const ratio = aspectRatioLabel(c.box?.width, c.box?.height);
      pendings.push({
        nodeId: c.id,
        label: name,
        sectionType: "grid_frames",
        kind: "grid_frames",
        assetId,
      });
      if (!sec.data.frames) sec.data.frames = [];
      sec.data.frames.push({
        id: generateUUID(),
        label: name.split("/").pop() || name,
        sublabel: ratio,
        aspectRatio: ratio,
        assetId,
      });
      assigned++;
    } else if (section === "applications") {
      pendings.push({
        nodeId: c.id,
        label: name,
        sectionType: "applications",
        kind: "applications",
        assetId,
      });
      if (!sec.data.apps) sec.data.apps = [];
      sec.data.apps.push({
        id: generateUUID(),
        label: name.split("/").pop() || name,
        subtitle: "Imported from Figma",
        tag: "Mockup",
        assetId,
      });
      assigned++;
    } else {
      unassigned++;
    }
  }

  return { pendings, assigned, unassigned };
}

export function pendingsToAssets(
  pendings: PendingExport[],
  sections: Partial<CISection>[]
) {
  return pendings.map((p) => {
    const sec =
      p.sectionType === "unmatched"
        ? null
        : sections.find((s) => s.section_type === p.sectionType);
    return makePendingAsset(p, sec?.id || null);
  });
}
