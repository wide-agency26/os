import { CISection, OverviewSectionData, LogoSectionData, ColorsSectionData, TypographySectionData, ButtonsSectionData, GridFramesSectionData, BackgroundsSectionData, ImagerySectionData, VoiceToneSectionData, ApplicationsSectionData, DosDontsSectionData } from "./types";

export function toPromptText(section: Partial<CISection>): string {
  const data = section.data || {};
  const type = section.section_type;

  switch (type) {
    case "overview": {
      const d = data as OverviewSectionData;
      const lines: string[] = [];
      if (d.leadParagraph) lines.push(d.leadParagraph);
      if (d.stats && d.stats.length > 0) {
        lines.push("Key Brand Metrics:");
        d.stats.forEach(st => lines.push(`- ${st.label}: ${st.value}`));
      }
      if (d.tonalityCards && d.tonalityCards.length > 0) {
        lines.push("Brand Pillars:");
        d.tonalityCards.forEach(c => lines.push(`- ${c.label || "Principle"}: ${c.text}`));
      }
      return lines.join("\n\n");
    }

    case "logo": {
      const d = data as LogoSectionData;
      const lines: string[] = ["LOGO USAGE RULES:"];
      if (d.logos && d.logos.length > 0) {
        lines.push("Approved Logo Variants:");
        d.logos.forEach(l => {
          lines.push(`- ${l.label} (${l.subtitle || "Mark"}): Use on ${l.stage || "any"} background stages.`);
        });
      }
      if (d.clearspaceText) {
        lines.push(`Clearspace Rule: ${d.clearspaceText}`);
      }
      if (d.minSizes && d.minSizes.length > 0) {
        lines.push("Minimum Sizes:");
        d.minSizes.forEach(ms => lines.push(`- ${ms.useCase}: Minimum ${ms.size}${ms.unit}`));
      }
      return lines.join("\n");
    }

    case "colors": {
      const d = data as ColorsSectionData;
      const lines: string[] = ["COLOR PALETTE & TOKENS:"];
      if (d.groups && d.groups.length > 0) {
        d.groups.forEach(group => {
          lines.push(`\n[${group.groupLabel}]`);
          group.swatches.forEach(s => {
            const varStr = s.cssVar ? ` (${s.cssVar})` : "";
            lines.push(`- ${s.name}: ${s.hex}${varStr}`);
          });
        });
      }
      return lines.join("\n");
    }

    case "typography": {
      const d = data as TypographySectionData;
      const lines: string[] = ["TYPOGRAPHY SPECS & TOKENS:"];
      if (d.rows && d.rows.length > 0) {
        lines.push("Text Hierarchy:");
        d.rows.forEach(r => {
          const spec = `${r.fontFamily || "Inter"}, ${r.fontSize || "16px"}, weight ${r.fontWeight || "400"}, line-height ${r.lineHeight || "1.4"}`;
          lines.push(`- ${r.label}: ${spec}`);
        });
      }
      if (d.scale && d.scale.length > 0) {
        lines.push("\nType Scale Tokens:");
        d.scale.forEach(s => lines.push(`- ${s.token}: ${s.px}px`));
      }
      return lines.join("\n");
    }

    case "buttons": {
      const d = data as ButtonsSectionData;
      const lines: string[] = ["BUTTON & INTERACTION STYLES:"];
      if (d.samples && d.samples.length > 0) {
        d.samples.forEach(s => {
          const def = s.defaultColors ? `bg: ${s.defaultColors.bg}, text: ${s.defaultColors.text}` : "default styling";
          const hov = s.hoverColors ? `hover bg: ${s.hoverColors.bg}` : "";
          lines.push(`- ${s.variant.toUpperCase()} Variant ("${s.label}"): ${def}. ${hov}`);
        });
      }
      return lines.join("\n");
    }

    case "grid_frames": {
      const d = data as GridFramesSectionData;
      const lines: string[] = ["GRID & FRAME TEMPLATES:"];
      if (d.frames && d.frames.length > 0) {
        d.frames.forEach(f => {
          lines.push(`- ${f.label} (${f.aspectRatio || "1:1"} ratio): ${f.sublabel || "Standard frame"}`);
        });
      }
      return lines.join("\n");
    }

    case "backgrounds": {
      const d = data as BackgroundsSectionData;
      const lines: string[] = ["BACKGROUND TREATMENTS:"];
      if (d.groups && d.groups.length > 0) {
        d.groups.forEach(g => {
          lines.push(`\n[${g.groupLabel}]`);
          g.assets.forEach(a => lines.push(`- ${a.label || "Background Motif"}`));
        });
      }
      return lines.join("\n");
    }

    case "imagery": {
      const d = data as ImagerySectionData;
      const lines: string[] = ["PHOTOGRAPHY & IMAGERY RULES:"];
      if (d.rules && d.rules.length > 0) {
        d.rules.forEach((r, idx) => {
          lines.push(`${idx + 1}. ${r.title}: ${r.description}`);
        });
      }
      return lines.join("\n");
    }

    case "voice_tone": {
      const d = data as VoiceToneSectionData;
      const lines: string[] = ["VOICE & TONE GUIDANCE:"];
      
      const pillars = (d.marqueeWords || []).map(p => typeof p === "string" ? p : p.word);
      if (pillars.length > 0) {
        lines.push(`Personality Pillars: ${pillars.join(", ")}`);
      }

      const dos = (d.doPhrases || []).map(p => typeof p === "string" ? p : p.text);
      if (dos.length > 0) {
        lines.push("\nSAY THIS (Approved Tone & Phrasing):");
        dos.forEach(p => lines.push(`✓ ${p}`));
      }

      const donts = (d.dontPhrases || []).map(p => typeof p === "string" ? p : p.text);
      if (donts.length > 0) {
        lines.push("\nAVOID THIS (Unapproved Tone & Phrasing):");
        donts.forEach(p => lines.push(`✕ ${p}`));
      }

      return lines.join("\n");
    }

    case "applications": {
      const d = data as ApplicationsSectionData;
      const lines: string[] = ["REAL-WORLD BRAND APPLICATIONS:"];
      if (d.apps && d.apps.length > 0) {
        d.apps.forEach(a => {
          lines.push(`- ${a.label}${a.tag ? ` [${a.tag}]` : ""}: ${a.subtitle || "Brand application context"}`);
        });
      }
      return lines.join("\n");
    }

    case "dos_donts": {
      const d = data as DosDontsSectionData;
      const lines: string[] = ["DO'S & DON'TS EXAMPLES:"];
      const items = d.items || [];
      const dos = items.filter(i => i.type === "do");
      const donts = items.filter(i => i.type === "dont");

      if (dos.length > 0) {
        lines.push("DO (Correct Usage):");
        dos.forEach(i => lines.push(`✓ ${i.caption}`));
      }
      if (donts.length > 0) {
        lines.push("\nDON'T (Incorrect Usage):");
        donts.forEach(i => lines.push(`✕ ${i.caption}`));
      }
      return lines.join("\n");
    }

    default: {
      return `${section.headline || section.eyebrow_label || type}: ${section.description || "Refer to brand guidelines."}`;
    }
  }
}

export function generateFullBrandPrompt(brandName: string, sections: Partial<CISection>[]): string {
  const visibleSections = sections.filter(s => s.is_visible !== false);
  const title = brandName || "Brand System";

  const header = `You are creating content for ${title}. Follow these official brand guidelines and instructions:\n`;

  const blocks = visibleSections.map(sec => {
    const secTitle = sec.eyebrow_label || sec.headline || sec.section_type?.toUpperCase() || "SECTION";
    const promptBody = toPromptText(sec);
    return `## ${secTitle}\n${promptBody}`;
  });

  return `${header}\n${blocks.join("\n\n")}`;
}
