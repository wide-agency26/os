import {
  CISection,
  OverviewSectionData,
  LogoSectionData,
  ColorsSectionData,
  TypographySectionData,
  ButtonsSectionData,
  GridFramesSectionData,
  BackgroundsSectionData,
  ImagerySectionData,
  VoiceToneSectionData,
  ApplicationsSectionData,
  DosDontsSectionData,
} from "./types";
import { getSubModule } from "./modules-catalog";

function applyTemplate(
  template: string,
  vars: Record<string, string> = {}
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`[${key}]`, value || "—");
  }
  // Strip unresolved placeholders to readable dashes
  out = out.replace(/\[[^\]]+\]/g, "—");
  return out;
}

function legacyPrompt(section: Partial<CISection>): string {
  const data = section.data || {};
  const type = section.section_type;

  switch (type) {
    case "overview": {
      const d = data as OverviewSectionData;
      const lines: string[] = [];
      if (d.leadParagraph) lines.push(d.leadParagraph);
      if (d.stats && d.stats.length > 0) {
        lines.push("Key Brand Metrics:");
        d.stats.forEach((st) => lines.push(`- ${st.label}: ${st.value}`));
      }
      if (d.tonalityCards && d.tonalityCards.length > 0) {
        lines.push("Brand Pillars:");
        d.tonalityCards.forEach((c) =>
          lines.push(`- ${c.label || "Principle"}: ${c.text}`)
        );
      }
      return lines.join("\n\n");
    }
    case "logo": {
      const d = data as LogoSectionData;
      const lines: string[] = ["LOGO USAGE RULES:"];
      (d.logos || []).forEach((l) => {
        lines.push(
          `- ${l.label} (${l.subtitle || "Mark"}): Use on ${l.stage || "any"} background stages.`
        );
      });
      if (d.clearspaceText) lines.push(`Clearspace Rule: ${d.clearspaceText}`);
      return lines.join("\n");
    }
    case "colors": {
      const d = data as ColorsSectionData;
      const lines: string[] = ["COLOR PALETTE & TOKENS:"];
      (d.groups || []).forEach((group) => {
        lines.push(`\n[${group.groupLabel}]`);
        group.swatches.forEach((s) => {
          const varStr = s.cssVar ? ` (${s.cssVar})` : "";
          lines.push(`- ${s.name}: ${s.hex}${varStr}`);
        });
      });
      return lines.join("\n");
    }
    case "typography": {
      const d = data as TypographySectionData;
      const lines: string[] = ["TYPOGRAPHY SPECS & TOKENS:"];
      (d.rows || []).forEach((r) => {
        lines.push(
          `- ${r.label}: ${r.fontFamily || "Inter"}, ${r.fontSize || "16px"}, weight ${r.fontWeight || "400"}`
        );
      });
      return lines.join("\n");
    }
    case "buttons": {
      const d = data as ButtonsSectionData;
      const lines: string[] = ["BUTTON & INTERACTION STYLES:"];
      (d.samples || []).forEach((s) => {
        lines.push(`- ${s.variant}: "${s.label}"`);
      });
      return lines.join("\n");
    }
    case "grid_frames": {
      const d = data as GridFramesSectionData;
      return (
        "GRID & FRAME TEMPLATES:\n" +
        (d.frames || [])
          .map((f) => `- ${f.label} (${f.aspectRatio || "1:1"})`)
          .join("\n")
      );
    }
    case "backgrounds": {
      const d = data as BackgroundsSectionData;
      const lines: string[] = ["BACKGROUND TREATMENTS:"];
      (d.groups || []).forEach((g) => {
        lines.push(`[${g.groupLabel}]`);
        g.assets.forEach((a) => lines.push(`- ${a.label || "Background"}`));
      });
      return lines.join("\n");
    }
    case "imagery": {
      const d = data as ImagerySectionData;
      return (
        "PHOTOGRAPHY & IMAGERY RULES:\n" +
        (d.rules || [])
          .map((r, i) => `${i + 1}. ${r.title}: ${r.description}`)
          .join("\n")
      );
    }
    case "voice_tone": {
      const d = data as VoiceToneSectionData;
      const lines: string[] = ["VOICE & TONE GUIDANCE:"];
      const pillars = (d.marqueeWords || []).map((p) =>
        typeof p === "string" ? p : p.word
      );
      if (pillars.length) lines.push(`Personality Pillars: ${pillars.join(", ")}`);
      return lines.join("\n");
    }
    case "applications": {
      const d = data as ApplicationsSectionData;
      return (
        "REAL-WORLD BRAND APPLICATIONS:\n" +
        (d.apps || []).map((a) => `- ${a.label}`).join("\n")
      );
    }
    case "dos_donts": {
      const d = data as DosDontsSectionData;
      const items = d.items || [];
      const lines: string[] = ["DO'S & DON'TS EXAMPLES:"];
      items
        .filter((i) => i.type === "do")
        .forEach((i) => lines.push(`✓ ${i.caption}`));
      items
        .filter((i) => i.type === "dont")
        .forEach((i) => lines.push(`✕ ${i.caption}`));
      return lines.join("\n");
    }
    default:
      return `${section.headline || section.eyebrow_label || type}: ${
        section.description || "Refer to brand guidelines."
      }`;
  }
}

export function toPromptText(
  section: Partial<CISection>,
  promptVars: Record<string, string> = {}
): string {
  const def = getSubModule(section.section_type);
  if (def?.promptTemplate) {
    const data = (section.data || {}) as Record<string, any>;
    const merged: Record<string, string> = {
      "Brand Name": promptVars["Brand Name"] || "",
      "Mission Statement":
        promptVars["Mission Statement"] || String(data.body || ""),
      "Vision Statement":
        promptVars["Vision Statement"] || String(data.body || ""),
      "Value List":
        promptVars["Value List"] ||
        (Array.isArray(data.items)
          ? data.items.map((i: any) => i.title).join(", ")
          : ""),
      Claim: promptVars.Claim || String(data.claim || ""),
      Pitch: promptVars.Pitch || String(data.pitch || ""),
      Archetype: promptVars.Archetype || String(data.archetype || ""),
      "Traits List":
        promptVars["Traits List"] ||
        (Array.isArray(data.traits)
          ? data.traits.map((t: any) => t.word).join(", ")
          : ""),
      "SVG URL": promptVars["SVG URL"] || "",
      URL: promptVars.URL || "",
      Hex: promptVars.Hex || data.swatches?.[0]?.hex || "",
      "Color Name":
        promptVars["Color Name"] || data.swatches?.[0]?.name || "",
      Font: promptVars.Font || data.fontFamily || "",
      Weight: promptVars.Weight || data.fontWeight || "",
      Px: promptVars.Px || data.fontSize || "",
      Leading: promptVars.Leading || data.lineHeight || "",
      Label: String(data.label || section.headline || ""),
      Description: String(data.caption || section.description || ""),
      ...promptVars,
    };
    // Prefer compiled AI system prompt body when present
    if (section.section_type === "ai_system_prompt" && data.prompt) {
      return String(data.prompt);
    }
    return applyTemplate(def.promptTemplate, merged);
  }
  return legacyPrompt(section);
}

export function generateFullBrandPrompt(
  brandName: string,
  sections: Partial<CISection>[]
): string {
  const visibleSections = sections.filter((s) => s.is_visible !== false);
  const title = brandName || "Brand System";
  const header = `You are creating content for ${title}. Follow these official brand guidelines and instructions:\n`;
  const blocks = visibleSections.map((sec) => {
    const secTitle =
      sec.eyebrow_label || sec.headline || sec.section_type?.toUpperCase() || "SECTION";
    const promptBody = toPromptText(sec, { "Brand Name": title });
    return `## ${secTitle}\n${promptBody}`;
  });
  return `${header}\n${blocks.join("\n\n")}`;
}
