/** Auto-derived from `lib/sow/CI Builder Modules - for cursor.csv` — 9 modules / 52 sub-modules. */

export type CiInputType =
  | "Form / Text Input"
  | "Figma Frame Import"
  | "Figma CSS / Style API"
  | "Figma CSS / Variables API";

export type CiRendererKind =
  | "archetype"
  | "claim_pitch"
  | "clearspace"
  | "code"
  | "color_format"
  | "color_group"
  | "color_scale"
  | "container_spec"
  | "copy_examples"
  | "deck"
  | "dual_list"
  | "email_sig"
  | "font_stack"
  | "icon_set"
  | "image_dual"
  | "image_slot"
  | "layout_grid"
  | "list"
  | "prompt_cards"
  | "sliders"
  | "spacing"
  | "text"
  | "type_scale"
  | "type_spec"
  | "type_tokens"
  | "ui_button"
  | "ui_states"
  | "wcag"
;

export type CiSubModuleId =
  | "mission"
  | "vision"
  | "core_values"
  | "claim_pitch"
  | "brand_personality"
  | "editorial_guidelines"
  | "tone_matrix"
  | "copywriting_examples"
  | "ai_system_prompt"
  | "primary_logo"
  | "secondary_logo"
  | "tertiary_logo"
  | "wordmark"
  | "image_mark"
  | "misc_logo"
  | "favicon"
  | "clear_space"
  | "misuse_examples"
  | "color_primary"
  | "color_secondary"
  | "color_accent"
  | "functional"
  | "hex"
  | "rgb"
  | "cmyk"
  | "color_scale"
  | "wcag_contrast"
  | "headline_primary"
  | "headline_secondary"
  | "headline_tertiary"
  | "body"
  | "caption"
  | "fallback_fonts"
  | "typography_scale"
  | "line_heights"
  | "letter_spacing"
  | "layout_grids"
  | "spacing_system"
  | "ui_primary"
  | "ui_secondary"
  | "ui_tertiary"
  | "interactive_states"
  | "form_controls"
  | "status_badges"
  | "layout_containers"
  | "photography_style"
  | "iconography"
  | "ai_image_prompts"
  | "social_4x5"
  | "social_9x16"
  | "email_signatures"
  | "presentation_deck"
;

export type CiModuleId =
  | "brand_core_strategy"
  | "brand_voice_ai_texting"
  | "logo_system"
  | "colors_systems"
  | "typography_properties"
  | "design_tokens"
  | "ui_elements"
  | "imagery"
  | "touchpoints"
;

export interface CiSubModuleDef {
  sectionType: CiSubModuleId;
  moduleId: CiModuleId;
  moduleIndex: number;
  moduleLabel: string;
  subModuleLabel: string;
  inputType: CiInputType;
  tier: string;
  adminEdit: string;
  elementsView: string;
  presentationView: string;
  promptTemplate: string;
  renderer: CiRendererKind;
  eyebrow: string;
  defaultHeadline: string;
  /** Figma path prefixes (first segment). */
  prefixes: string[];
  synonyms: string[];
}

export const CI_SUBMODULES: CiSubModuleDef[] = [
  {
    sectionType: "mission",
    moduleId: "brand_core_strategy",
    moduleIndex: 1,
    moduleLabel: "Brand Core & Strategy",
    subModuleLabel: "Mission",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "<EditableText> rich text editor with word counter and live autosave.",
    elementsView: "Copy-to-clipboard raw text button + markdown snippet export.",
    presentationView: "Hero section with bold accent quote typography and high-contrast glassmorphism card.",
    promptTemplate: "Copies LLM instruction: \"Act as [Brand Name] Strategy Engine. Core Mission: [Mission Statement]. Align all messaging to this mission.\"",
    renderer: "text",
    eyebrow: "01.01 · Mission",
    defaultHeadline: "Mission",
    prefixes: ["Mission", "BrandCore", "Strategy"],
    synonyms: ["mission", "purpose"],
  },
  {
    sectionType: "vision",
    moduleId: "brand_core_strategy",
    moduleIndex: 1,
    moduleLabel: "Brand Core & Strategy",
    subModuleLabel: "Vision",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "<EditableText> rich text editor with autosave.",
    elementsView: "Copy-to-clipboard raw text button + pitch deck copy snippet.",
    presentationView: "Editorial card with dynamic entrance animation and accent border.",
    promptTemplate: "Copies LLM instruction: \"Brand Vision: [Vision Statement]. Align long-term positioning and strategic narrative to this future state.\"",
    renderer: "text",
    eyebrow: "01.02 · Vision",
    defaultHeadline: "Vision",
    prefixes: ["Vision"],
    synonyms: ["vision", "northstar"],
  },
  {
    sectionType: "core_values",
    moduleId: "brand_core_strategy",
    moduleIndex: 1,
    moduleLabel: "Brand Core & Strategy",
    subModuleLabel: "Core Values",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "Reorderable <EditableListItem> array with inline title/description popovers and \"+ Add Value\" button.",
    elementsView: "Downloadable value cards (PNG/SVG) + bulleted plain-text export.",
    presentationView: "3-column interactive grid with dynamic index badges (01, 02, 03) and hover glow.",
    promptTemplate: "Copies LLM instruction: \"Core Values for [Brand Name]: [Value List]. Reject copy that violates these pillars.\"",
    renderer: "list",
    eyebrow: "01.03 · Core Values",
    defaultHeadline: "Core Values",
    prefixes: ["Values", "CoreValues"],
    synonyms: ["values", "pillars"],
  },
  {
    sectionType: "claim_pitch",
    moduleId: "brand_core_strategy",
    moduleIndex: 1,
    moduleLabel: "Brand Core & Strategy",
    subModuleLabel: "Claim / Pitch",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "<EditableText> for 1-liner claim + 30-sec elevator pitch modal editor.",
    elementsView: "Copyable claim badge + plain-text snippet for pitch decks and press releases.",
    presentationView: "Full-width callout block with oversized quotes and brand-themed accent line.",
    promptTemplate: "Copies LLM instruction: \"Brand Claim: [Claim]. Pitch: [Pitch]. Use as primary hook for headlines, hero sections, and GTM copy.\"",
    renderer: "claim_pitch",
    eyebrow: "01.04 · Claim / Pitch",
    defaultHeadline: "Claim / Pitch",
    prefixes: ["Claim", "Pitch"],
    synonyms: ["claim", "tagline", "pitch"],
  },
  {
    sectionType: "brand_personality",
    moduleId: "brand_core_strategy",
    moduleIndex: 1,
    moduleLabel: "Brand Core & Strategy",
    subModuleLabel: "Brand Personality & Archetype",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "Archetype dropdown selector + pill-tag editor for personality traits.",
    elementsView: "Archetype summary tag + downloadable persona summary PDF/PNG.",
    presentationView: "Visual archetype badge with trait radar/slider visualizer and glowing pill tags.",
    promptTemplate: "Copies LLM instruction: \"Brand Archetype: [Archetype]. Primary Traits: [Traits List]. Tone MUST feel high-velocity, confident, and direct.\"",
    renderer: "archetype",
    eyebrow: "01.05 · Brand Personality & Archetype",
    defaultHeadline: "Brand Personality & Archetype",
    prefixes: ["Personality", "Archetype"],
    synonyms: ["archetype", "persona", "personality"],
  },
  {
    sectionType: "editorial_guidelines",
    moduleId: "brand_core_strategy",
    moduleIndex: 1,
    moduleLabel: "Brand Core & Strategy",
    subModuleLabel: "Editorial Guidelines (Do's & Don'ts)",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "Dual-column <EditableListItem> list (Do's / Don'ts) with inline inputs and reordering handles.",
    elementsView: "Quick-reference copyable rule checklist for writers and agency partners.",
    presentationView: "Side-by-side Emerald Green (✓) vs. Rose Red (✗) comparison cards with crisp typography.",
    promptTemplate: "Copies LLM instruction: \"Editorial Rules: ALWAYS: [Do's List]. NEVER: [Don'ts List]. Reject corporate fluff and passive voice.\"",
    renderer: "dual_list",
    eyebrow: "01.06 · Editorial Guidelines (Do's & Don'ts)",
    defaultHeadline: "Editorial Guidelines (Do's & Don'ts)",
    prefixes: ["Editorial", "DoDont", "Guidelines"],
    synonyms: ["editorial", "dos", "donts"],
  },
  {
    sectionType: "tone_matrix",
    moduleId: "brand_voice_ai_texting",
    moduleIndex: 2,
    moduleLabel: "Brand Voice & AI Texting",
    subModuleLabel: "Tone of Voice Matrix Sliders",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "Interactive multi-axis slider inputs (Formal vs. Casual, Punchy vs. Detailed) with weight numbers.",
    elementsView: "Raw numeric tone scores (0–100) + JSON tone configuration snippet.",
    presentationView: "Visual tone matrix chart with interactive multi-axis balance sliders.",
    promptTemplate: "Copies LLM instruction: \"Tone Calibration: [Axis 1]: [Score]/100, [Axis 2]: [Score]/100. Match copy density and pacing to these exact parameters.\"",
    renderer: "sliders",
    eyebrow: "02.01 · Tone of Voice Matrix Sliders",
    defaultHeadline: "Tone of Voice Matrix Sliders",
    prefixes: ["Tone", "Voice"],
    synonyms: ["tone", "matrix", "slider"],
  },
  {
    sectionType: "copywriting_examples",
    moduleId: "brand_voice_ai_texting",
    moduleIndex: 2,
    moduleLabel: "Brand Voice & AI Texting",
    subModuleLabel: "Copywriting Examples",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "Dual-column text editor for \"Approved Copy\" vs. \"Forbidden Copy\" paired examples.",
    elementsView: "Copyable text snippets + markdown reference sheet for copywriters.",
    presentationView: "High-contrast side-by-side card rendering with green checkmark and red cross tags.",
    promptTemplate: "Copies LLM instruction: \"Copywriting Benchmarks: APPROVED COPY: [Good Examples]. REJECTED COPY: [Bad Examples]. Mirror structure and cadence.\"",
    renderer: "copy_examples",
    eyebrow: "02.02 · Copywriting Examples",
    defaultHeadline: "Copywriting Examples",
    prefixes: ["Copy", "Copywriting"],
    synonyms: ["copywriting", "examples"],
  },
  {
    sectionType: "ai_system_prompt",
    moduleId: "brand_voice_ai_texting",
    moduleIndex: 2,
    moduleLabel: "Brand Voice & AI Texting",
    subModuleLabel: "AI System Prompt",
    inputType: "Form / Text Input",
    tier: "Optional",
    adminEdit: "Syntax-highlighted code editor with variable tags ({brand_name}, {tone}, {mission}).",
    elementsView: "1-Click \"Copy Master Prompt\" button + download button for custom GPT setup.",
    presentationView: "Dark-mode terminal component with live syntax highlighting and copy toast confirmation.",
    promptTemplate: "Copies compiled LLM System Prompt: \"[Full Compiled Master AI System Prompt with dynamic brand variables resolved].\"",
    renderer: "code",
    eyebrow: "02.03 · AI System Prompt",
    defaultHeadline: "AI System Prompt",
    prefixes: ["AIPrompt", "SystemPrompt"],
    synonyms: ["system prompt", "llm"],
  },
  {
    sectionType: "primary_logo",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Primary Logo",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "<EditableImage> slot picker + stage toggle (Dark/Light) + aspect ratio popover.",
    elementsView: "1-Click SVG/PNG asset downloads + raw inline SVG code viewer & copy button.",
    presentationView: "Interactive dark/light stage comparison toggle with full-bleed vector rendering.",
    promptTemplate: "Copies LLM instruction: \"Primary Logo Asset URL: [SVG URL]. Stage: [Dark/Light]. Render lockup prominently without alteration.\"",
    renderer: "image_slot",
    eyebrow: "03.01 · Primary Logo",
    defaultHeadline: "Primary Logo",
    prefixes: ["Logo", "PrimaryLogo"],
    synonyms: ["primary logo", "logo"],
  },
  {
    sectionType: "secondary_logo",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Secondary Logo",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> slot picker + layout orientation selector (Horizontal/Vertical).",
    elementsView: "SVG & PNG asset download buttons + pixel dimension specs.",
    presentationView: "Responsive card grid with background contrast toggle and dimension overlay.",
    promptTemplate: "Copies LLM instruction: \"Secondary Logo Asset URL: [SVG URL]. Use when primary layout constraints restrict vertical clearance.\"",
    renderer: "image_slot",
    eyebrow: "03.02 · Secondary Logo",
    defaultHeadline: "Secondary Logo",
    prefixes: ["SecondaryLogo"],
    synonyms: ["secondary logo"],
  },
  {
    sectionType: "tertiary_logo",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Tertiary Logo",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> slot picker + usage context label editor.",
    elementsView: "SVG & PNG asset download buttons + raw SVG code copy button.",
    presentationView: "Minimalist presentation tile with dark/light stage preview.",
    promptTemplate: "Copies LLM instruction: \"Tertiary Logo Asset URL: [SVG URL]. Use for compact badge placements and micro-headers.\"",
    renderer: "image_slot",
    eyebrow: "03.03 · Tertiary Logo",
    defaultHeadline: "Tertiary Logo",
    prefixes: ["TertiaryLogo"],
    synonyms: ["tertiary logo"],
  },
  {
    sectionType: "wordmark",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Wordmark",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> slot picker + width percentage and alignment inputs.",
    elementsView: "SVG download button + raw inline SVG string copy button.",
    presentationView: "Clean horizontal stage container with scale verification bounds.",
    promptTemplate: "Copies LLM instruction: \"Wordmark Asset URL: [SVG URL]. Use wordmark independently only when brand mark is established in context.\"",
    renderer: "image_slot",
    eyebrow: "03.04 · Wordmark",
    defaultHeadline: "Wordmark",
    prefixes: ["Wordmark"],
    synonyms: ["wordmark", "wortmarke"],
  },
  {
    sectionType: "image_mark",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Image Mark",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> slot picker + bounding box fit controls.",
    elementsView: "Direct icon SVG/PNG download + favicon/avatar zip exporter.",
    presentationView: "Square icon stage card with dark/light background fill toggles.",
    promptTemplate: "Copies LLM instruction: \"Image Mark Asset URL: [SVG URL]. Use as standalone graphic mark for app icons, avatars, and favicons.\"",
    renderer: "image_slot",
    eyebrow: "03.05 · Image Mark",
    defaultHeadline: "Image Mark",
    prefixes: ["ImageMark", "Brandmark", "Logomark"],
    synonyms: ["bildmarke", "brandmark", "symbol"],
  },
  {
    sectionType: "misc_logo",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Misc (can be anything)",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "Generic image asset manager + title/description text editor.",
    elementsView: "Asset download link + public CDN image URL copy button.",
    presentationView: "Flexible presentation card container with custom image captioning.",
    promptTemplate: "Copies LLM instruction: \"Auxiliary Logo Asset: [Label]. File URL: [URL]. Guidelines: [Description].\"",
    renderer: "image_slot",
    eyebrow: "03.06 · Misc (can be anything)",
    defaultHeadline: "Misc (can be anything)",
    prefixes: ["LogoMisc", "Misc"],
    synonyms: ["misc logo"],
  },
  {
    sectionType: "favicon",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Favicon",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "Multi-size icon dropzone (16x16, 32x32, .ico/.svg) + shape mask selector.",
    elementsView: "Direct .ico, .svg, and PNG package zip download button.",
    presentationView: "Interactive browser tab mockup displaying live favicon rendering.",
    promptTemplate: "Copies LLM instruction: \"Favicon Asset URL: [SVG URL]. Ensure pixel clarity at 16x16px and 32x32px viewports.\"",
    renderer: "image_slot",
    eyebrow: "03.07 · Favicon",
    defaultHeadline: "Favicon",
    prefixes: ["Favicon"],
    synonyms: ["favicon", "app icon"],
  },
  {
    sectionType: "clear_space",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Usage Rules (Clear Space)",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "Clearspace multiplier input (e.g. 1.5x) + SVG bounding diagram picker.",
    elementsView: "Downloadable vector clearspace spec overlay sheet.",
    presentationView: "Interactive vector bounding box overlay showing clearance margins on hover.",
    promptTemplate: "Copies LLM instruction: \"Clearspace Rule: Minimum exclusion zone around logo is equal to [X] times the height of mark X.\"",
    renderer: "clearspace",
    eyebrow: "03.08 · Usage Rules (Clear Space)",
    defaultHeadline: "Usage Rules (Clear Space)",
    prefixes: ["Clearspace", "ClearSpace", "Usage"],
    synonyms: ["clearspace", "clear space"],
  },
  {
    sectionType: "misuse_examples",
    moduleId: "logo_system",
    moduleIndex: 3,
    moduleLabel: "Logo System",
    subModuleLabel: "Misuse Examples",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "Dual-column <EditableImage> list + caption inputs (\"Do Not Stretch\", \"Do Not Recolor\").",
    elementsView: "Downloadable logo misuse reference cheat-sheet (PDF/PNG).",
    presentationView: "Visual grid featuring red warning badges (✗) over distorted logo anti-examples.",
    promptTemplate: "Copies LLM instruction: \"Unacceptable Logo Modifications: NEVER stretch, recolor, add shadows, or rotate logo lockups. Violations: [List].\"",
    renderer: "image_dual",
    eyebrow: "03.09 · Misuse Examples",
    defaultHeadline: "Misuse Examples",
    prefixes: ["Misuse", "LogoMisuse"],
    synonyms: ["misuse"],
  },
  {
    sectionType: "color_primary",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "Primary",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "<EditableColor> popover (Hex picker, Color Name, CSS Var Name) + auto-sync trigger.",
    elementsView: "Swatch card with 1-click Hex/RGB copy + :root CSS variable code export.",
    presentationView: "Full-width color bar display with dynamic text contrast detection (WCAG check).",
    promptTemplate: "Copies LLM instruction: \"Primary Palette: [Color Name] ([Hex]). Main background and structural color token.\"",
    renderer: "color_group",
    eyebrow: "04.01 · Primary",
    defaultHeadline: "Primary",
    prefixes: ["Colors", "Color", "Primary"],
    synonyms: ["primary color", "farbe"],
  },
  {
    sectionType: "color_secondary",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "Secondary",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "<EditableColor> popover (Hex picker, Color Name, CSS Var Name) + auto-sync trigger.",
    elementsView: "Swatch card with 1-click Hex/RGB copy + CSS variable export.",
    presentationView: "Color bar block with dynamic AAA contrast label overlays.",
    promptTemplate: "Copies LLM instruction: \"Secondary Palette: [Color Name] ([Hex]). Structural card and container surface color token.\"",
    renderer: "color_group",
    eyebrow: "04.02 · Secondary",
    defaultHeadline: "Secondary",
    prefixes: ["Secondary"],
    synonyms: ["secondary color"],
  },
  {
    sectionType: "color_accent",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "Accent",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "<EditableColor> popover (Hex picker, Color Name, CSS Var Name) + auto-sync trigger.",
    elementsView: "Swatch card with 1-click Hex/RGB copy + CSS variable export.",
    presentationView: "Vibrant glow-effect swatch strip with interactive hover state.",
    promptTemplate: "Copies LLM instruction: \"Accent Palette: [Color Name] ([Hex]). Use strictly for CTAs, highlights, and active states.\"",
    renderer: "color_group",
    eyebrow: "04.03 · Accent",
    defaultHeadline: "Accent",
    prefixes: ["Accent"],
    synonyms: ["accent color"],
  },
  {
    sectionType: "functional",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "Functional (error, success)",
    inputType: "Figma CSS / Style API",
    tier: "optional",
    adminEdit: "<EditableColor> array for Success, Warning, Error, Info colors.",
    elementsView: "System status swatch list with raw CSS variable snippet export.",
    presentationView: "Compact status badge matrix displaying functional color usage.",
    promptTemplate: "Copies LLM instruction: \"Functional Tokens: Success: [Hex], Error: [Hex], Warning: [Hex], Info: [Hex]. Match standard system alerts.\"",
    renderer: "color_group",
    eyebrow: "04.04 · Functional (error, success)",
    defaultHeadline: "Functional (error, success)",
    prefixes: ["Functional", "Status"],
    synonyms: ["error", "success", "warning"],
  },
  {
    sectionType: "hex",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "HEX",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Parsed Hex string input with live color sync.",
    elementsView: "1-Click \"Copy HEX\" button per swatch.",
    presentationView: "Uppercase Hex display tag overlay on swatch cards.",
    promptTemplate: "Copies LLM instruction: \"Hex Color Mapping: [Color Name]: [Hex Code].\"",
    renderer: "color_format",
    eyebrow: "04.05 · HEX",
    defaultHeadline: "HEX",
    prefixes: ["HEX", "Hex"],
    synonyms: ["hex"],
  },
  {
    sectionType: "rgb",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "RGB",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Auto-calculated RGB values from parsed Hex + manual override.",
    elementsView: "1-Click \"Copy RGB (rgb(r,g,b))\" button.",
    presentationView: "Micro RGB label tag inside element details drawer.",
    promptTemplate: "Copies LLM instruction: \"RGB Color Mapping: [Color Name]: rgb([R], [G], [B]).\"",
    renderer: "color_format",
    eyebrow: "04.06 · RGB",
    defaultHeadline: "RGB",
    prefixes: ["RGB"],
    synonyms: ["rgb"],
  },
  {
    sectionType: "cmyk",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "CMYK",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "CMYK print formula input (C% M% Y% K%).",
    elementsView: "1-Click \"Copy CMYK\" button for print production handoffs.",
    presentationView: "Print-ready spec badge with CMYK values for physical collateral.",
    promptTemplate: "Copies LLM instruction: \"Print Color Standard (CMYK): [Color Name]: C:[C] M:[M] Y:[Y] K:[K].\"",
    renderer: "color_format",
    eyebrow: "04.07 · CMYK",
    defaultHeadline: "CMYK",
    prefixes: ["CMYK"],
    synonyms: ["cmyk", "print"],
  },
  {
    sectionType: "color_scale",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "Color Scale (blue-500, neutral-100)",
    inputType: "Figma CSS / Style API",
    tier: "optional",
    adminEdit: "Color scale shade generator (Shades 50 to 900) + Hex tweak inputs.",
    elementsView: "Downloadable tailwind.config.js color object or CSS variables file.",
    presentationView: "Gradient scale waterfall display showing shade progression.",
    promptTemplate: "Copies LLM instruction: \"Shade Scale: [Base Token]: { 50: [Hex], 100: [Hex], ..., 900: [Hex] }.\"",
    renderer: "color_scale",
    eyebrow: "04.08 · Color Scale (blue-500, neutral-100)",
    defaultHeadline: "Color Scale (blue-500, neutral-100)",
    prefixes: ["Scale", "ColorScale"],
    synonyms: ["shade", "tailwind"],
  },
  {
    sectionType: "wcag_contrast",
    moduleId: "colors_systems",
    moduleIndex: 4,
    moduleLabel: "Colors Systems",
    subModuleLabel: "Accessibility & WCAG Contrast Rules",
    inputType: "Figma CSS / Style API",
    tier: "for v2",
    adminEdit: "Automated contrast ratio matrix checker + pass/fail status toggles.",
    elementsView: "Accessibility compliance summary sheet (WCAG AAA/AA rating).",
    presentationView: "Visual contrast compliance matrix showing compliant background/text pairs.",
    promptTemplate: "Copies LLM instruction: \"Accessibility Guardrail: Text on [Bg Hex] MUST use [Text Hex] (Contrast Ratio: [X]:1 - WCAG AAA compliant).\"",
    renderer: "wcag",
    eyebrow: "04.09 · Accessibility & WCAG Contrast Rules",
    defaultHeadline: "Accessibility & WCAG Contrast Rules",
    prefixes: ["Accessibility", "WCAG", "Contrast"],
    synonyms: ["wcag", "contrast", "a11y"],
  },
  {
    sectionType: "headline_primary",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Headline Primary",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Font Spec Popover (Family, Weight, Size px, Leading, Tracking).",
    elementsView: "@font-face CSS code snippet + font file .woff2 download button.",
    presentationView: "Massive display typography hero rendering sample headline live.",
    promptTemplate: "Copies LLM instruction: \"Headline Primary Style: Family: [Font], Weight: [Weight], Size: [Px], Leading: [Leading]. Line-height MUST stay tight.\"",
    renderer: "type_spec",
    eyebrow: "05.01 · Headline Primary",
    defaultHeadline: "Headline Primary",
    prefixes: ["Typography", "Type", "Headline"],
    synonyms: ["display", "h1"],
  },
  {
    sectionType: "headline_secondary",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Headline Secondary",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Font Spec Popover (Family, Weight, Size px, Leading, Tracking).",
    elementsView: "@font-face CSS snippet + font file .woff2 download button.",
    presentationView: "H2/H3 editorial layout specimen card.",
    promptTemplate: "Copies LLM instruction: \"Headline Secondary Style: Family: [Font], Weight: [Weight], Size: [Px].\"",
    renderer: "type_spec",
    eyebrow: "05.02 · Headline Secondary",
    defaultHeadline: "Headline Secondary",
    prefixes: ["HeadlineSecondary"],
    synonyms: ["h2"],
  },
  {
    sectionType: "headline_tertiary",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Headline Tertiary",
    inputType: "Figma CSS / Style API",
    tier: "Optional",
    adminEdit: "Font Spec Popover (Family, Weight, Size px, Leading, Tracking).",
    elementsView: "@font-face CSS snippet + font file .woff2 download button.",
    presentationView: "H4/H5 section sub-header card rendering live.",
    promptTemplate: "Copies LLM instruction: \"Headline Tertiary Style: Family: [Font], Weight: [Weight], Size: [Px].\"",
    renderer: "type_spec",
    eyebrow: "05.03 · Headline Tertiary",
    defaultHeadline: "Headline Tertiary",
    prefixes: ["HeadlineTertiary"],
    synonyms: ["h3", "h4"],
  },
  {
    sectionType: "body",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Body",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Font Spec Popover (Family, Weight, Size px, Line-height).",
    elementsView: "Copyable body text CSS utility classes.",
    presentationView: "Paragraph specimen card with inline link and bolding samples.",
    promptTemplate: "Copies LLM instruction: \"Body Text Style: Family: [Font], Weight: [Weight], Size: [Px], Line-Height: [Ratio]. Ensure high legibility.\"",
    renderer: "type_spec",
    eyebrow: "05.04 · Body",
    defaultHeadline: "Body",
    prefixes: ["Body"],
    synonyms: ["body", "paragraph"],
  },
  {
    sectionType: "caption",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Caption",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Font Spec Popover (Family, Weight, Size px, Tracking).",
    elementsView: "Copyable micro-text CSS classes.",
    presentationView: "Caption / metadata tag specimen display block.",
    promptTemplate: "Copies LLM instruction: \"Caption Text Style: Family: [Font], Size: [Px], Letter-Spacing: [Tracking].\"",
    renderer: "type_spec",
    eyebrow: "05.05 · Caption",
    defaultHeadline: "Caption",
    prefixes: ["Caption"],
    synonyms: ["caption", "meta"],
  },
  {
    sectionType: "fallback_fonts",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Fallback Fonts",
    inputType: "Figma CSS / Style API",
    tier: "Optional",
    adminEdit: "Stack Editor input (e.g. system-ui, -apple-system, sans-serif).",
    elementsView: "Raw CSS font-family declaration string snippet.",
    presentationView: "Rendered fallback stack verification card.",
    promptTemplate: "Copies LLM instruction: \"Font Stack Fallbacks: [Primary Font], [Fallback Stack]. Always include system fallbacks.\"",
    renderer: "font_stack",
    eyebrow: "05.06 · Fallback Fonts",
    defaultHeadline: "Fallback Fonts",
    prefixes: ["Fallback", "FontStack"],
    synonyms: ["fallback"],
  },
  {
    sectionType: "typography_scale",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Typography Scale",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Type Scale Table Editor (Display down to Caption).",
    elementsView: "Tailwind CSS theme.fontSize configuration object download.",
    presentationView: "Waterfall type scale preview (Display down to Caption) with live typing canvas.",
    promptTemplate: "Copies LLM instruction: \"Type Hierarchy Ratios: Display: [Size], H1: [Size], H2: [Size], Body: [Size], Caption: [Size].\"",
    renderer: "type_scale",
    eyebrow: "05.07 · Typography Scale",
    defaultHeadline: "Typography Scale",
    prefixes: ["TypeScale", "Scale"],
    synonyms: ["type scale"],
  },
  {
    sectionType: "line_heights",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Line-Heights",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Line-Height Spec Form (em, %, or px per size token).",
    elementsView: "Copyable typography line-height token map.",
    presentationView: "Interactive leading adjustment card showing tight vs. loose line spacing.",
    promptTemplate: "Copies LLM instruction: \"Line-Height Parameters: Headlines: [Tight Ratio]; Body: [Relaxed Ratio]. Never collapse descenders.\"",
    renderer: "type_tokens",
    eyebrow: "05.08 · Line-Heights",
    defaultHeadline: "Line-Heights",
    prefixes: ["LineHeight", "Leading"],
    synonyms: ["leading", "line-height"],
  },
  {
    sectionType: "letter_spacing",
    moduleId: "typography_properties",
    moduleIndex: 5,
    moduleLabel: "Typography Properties",
    subModuleLabel: "Letter-Spacing",
    inputType: "Figma CSS / Style API",
    tier: "Essential",
    adminEdit: "Tracking Spec Form (em or px values per size token).",
    elementsView: "Copyable letter-spacing token map.",
    presentationView: "Visual tracking specimen card comparing wide vs. tight kerning.",
    promptTemplate: "Copies LLM instruction: \"Letter-Spacing Tokens: Display: [Negative Tracking]; Captions: [Positive Tracking].\"",
    renderer: "type_tokens",
    eyebrow: "05.09 · Letter-Spacing",
    defaultHeadline: "Letter-Spacing",
    prefixes: ["Tracking", "LetterSpacing"],
    synonyms: ["tracking", "kerning"],
  },
  {
    sectionType: "layout_grids",
    moduleId: "design_tokens",
    moduleIndex: 6,
    moduleLabel: "Design Tokens",
    subModuleLabel: "Layout Grids",
    inputType: "Figma CSS / Variables API",
    tier: "CI Builder v2",
    adminEdit: "Grid Token Form (Columns, Gutters px, Margins px, Max-width px).",
    elementsView: "Exportable grids.json token file + CSS grid utility snippet.",
    presentationView: "Visual container query ruler card with column overlay toggle.",
    promptTemplate: "Copies LLM instruction: \"Layout Grid Rules: [Cols]-column grid, Gutters: [Gutter]px, Margins: [Margin]px, Max Container: [Width]px.\"",
    renderer: "layout_grid",
    eyebrow: "06.01 · Layout Grids",
    defaultHeadline: "Layout Grids",
    prefixes: ["Grid", "Layout", "Raster"],
    synonyms: ["grid", "columns", "gutter"],
  },
  {
    sectionType: "spacing_system",
    moduleId: "design_tokens",
    moduleIndex: 6,
    moduleLabel: "Design Tokens",
    subModuleLabel: "Spacing System",
    inputType: "Figma CSS / Variables API",
    tier: "CI Builder v2",
    adminEdit: "Spacing Scale Form (xs, sm, md, lg, xl, 2xl in px).",
    elementsView: "Exportable spacing.json token file or Tailwind spacing object.",
    presentationView: "Visual spacing ruler overlay illustrating padding and margin steps.",
    promptTemplate: "Copies LLM instruction: \"Spacing Tokens: Scale: { xs: [Px], sm: [Px], md: [Px], lg: [Px], xl: [Px] }. Enforce 8px grid.\"",
    renderer: "spacing",
    eyebrow: "06.02 · Spacing System",
    defaultHeadline: "Spacing System",
    prefixes: ["Spacing"],
    synonyms: ["spacing", "padding", "margin"],
  },
  {
    sectionType: "ui_primary",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Primary",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "<EditableImage> frame slot + Border Radius, Padding, and Bg inputs.",
    elementsView: "Copyable Tailwind button code + raw SVG frame download.",
    presentationView: "Live interactive button canvas with light/dark backdrop toggle.",
    promptTemplate: "Copies LLM instruction: \"Primary Button Specs: Bg: [Hex], Text: [Hex], Border-Radius: [Px], Padding: [Padding].\"",
    renderer: "ui_button",
    eyebrow: "07.01 · Primary",
    defaultHeadline: "Primary",
    prefixes: ["Buttons", "UI", "PrimaryButton"],
    synonyms: ["button", "primary button"],
  },
  {
    sectionType: "ui_secondary",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Secondary",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "<EditableImage> frame slot + Border & Text color pickers.",
    elementsView: "Copyable Tailwind button code + raw SVG frame download.",
    presentationView: "Live interactive button canvas with light/dark backdrop toggle.",
    promptTemplate: "Copies LLM instruction: \"Secondary Button Specs: Border: [Hex], Text: [Hex], Background: Transparent.\"",
    renderer: "ui_button",
    eyebrow: "07.02 · Secondary",
    defaultHeadline: "Secondary",
    prefixes: ["SecondaryButton"],
    synonyms: ["secondary button"],
  },
  {
    sectionType: "ui_tertiary",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Tertiary",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> frame slot + Hover effect inputs.",
    elementsView: "Copyable CSS class snippet + SVG export.",
    presentationView: "Interactive text-button canvas with underline hover preview.",
    promptTemplate: "Copies LLM instruction: \"Tertiary Button Specs: Text-only link style with hover accent color [Hex].\"",
    renderer: "ui_button",
    eyebrow: "07.03 · Tertiary",
    defaultHeadline: "Tertiary",
    prefixes: ["TertiaryButton", "Ghost"],
    synonyms: ["ghost button", "text button"],
  },
  {
    sectionType: "interactive_states",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Interactive States (Hover, Active Focus)",
    inputType: "Figma Frame Import",
    tier: "Essential",
    adminEdit: "Multi-slot editor for Default, Hover, Active, Focus visual states.",
    elementsView: "State matrix code block (CSS :hover, :active, :focus-visible).",
    presentationView: "Interactive component playground rendering dynamic state shifts on hover/click.",
    promptTemplate: "Copies LLM instruction: \"UI Component Hover/Active Specs: Hover Bg: [Hex], Active Scale: 0.98, Focus Ring: [Hex].\"",
    renderer: "ui_states",
    eyebrow: "07.04 · Interactive States (Hover, Active Focus)",
    defaultHeadline: "Interactive States (Hover, Active Focus)",
    prefixes: ["States", "Hover", "Focus"],
    synonyms: ["hover", "active", "focus"],
  },
  {
    sectionType: "form_controls",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Form Controls",
    inputType: "Figma Frame Import",
    tier: "CI Builder v2",
    adminEdit: "Image slot picker for Inputs, Checkboxes, Radios, Toggles + state inputs.",
    elementsView: "Form element CSS library code export.",
    presentationView: "Live interactive form sandbox (Input, Checkbox, Toggle switches).",
    promptTemplate: "Copies LLM instruction: \"Form Control Specs: Input Border: [Hex], Focus Border: [Accent Hex], Border-Radius: [Px].\"",
    renderer: "image_slot",
    eyebrow: "07.05 · Form Controls",
    defaultHeadline: "Form Controls",
    prefixes: ["Forms", "Inputs"],
    synonyms: ["input", "checkbox", "toggle"],
  },
  {
    sectionType: "status_badges",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Feedback & Status Badges",
    inputType: "Figma Frame Import",
    tier: "CI Builder v2",
    adminEdit: "Image slot picker for Status Badges (Success, Warning, Info).",
    elementsView: "Copyable HTML/Tailwind badge component snippets.",
    presentationView: "Interactive status badge showcase grid.",
    promptTemplate: "Copies LLM instruction: \"Badge Tokens: Success: Bg [Hex]/Text [Hex]; Warning: Bg [Hex]/Text [Hex].\"",
    renderer: "image_slot",
    eyebrow: "07.06 · Feedback & Status Badges",
    defaultHeadline: "Feedback & Status Badges",
    prefixes: ["Badges", "Feedback"],
    synonyms: ["badge", "status"],
  },
  {
    sectionType: "layout_containers",
    moduleId: "ui_elements",
    moduleIndex: 7,
    moduleLabel: "UI Elements",
    subModuleLabel: "Layout Containers (Cards, Modals)",
    inputType: "Figma Frame Import",
    tier: "CI Builder v2",
    adminEdit: "Container Spec Form (Card Bg, Blur opacity, Border, Shadow).",
    elementsView: "Copyable glassmorphism / card CSS container utility classes.",
    presentationView: "Styled card and modal container showcase canvas.",
    promptTemplate: "Copies LLM instruction: \"Container UI Specs: Surface Bg: [Hex], Border: [Hex], Radius: [Px], Shadow: [Shadow Spec].\"",
    renderer: "container_spec",
    eyebrow: "07.07 · Layout Containers (Cards, Modals)",
    defaultHeadline: "Layout Containers (Cards, Modals)",
    prefixes: ["Cards", "Modals", "Containers"],
    synonyms: ["card", "modal", "glass"],
  },
  {
    sectionType: "photography_style",
    moduleId: "imagery",
    moduleIndex: 8,
    moduleLabel: "Imagery",
    subModuleLabel: "Photography Style (Do's & Don'ts)",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "Dual-column <EditableImage> + caption text popovers.",
    elementsView: "Downloadable photo direction reference guide (PDF/PNG).",
    presentationView: "Side-by-side photography comparison grid with green/red status badges.",
    promptTemplate: "Copies LLM instruction: \"Photography Direction: Approved subjects: [Do Captions]. Prohibited styles: [Don't Captions]. High contrast, human-first.\"",
    renderer: "image_dual",
    eyebrow: "08.01 · Photography Style (Do's & Don'ts)",
    defaultHeadline: "Photography Style (Do's & Don'ts)",
    prefixes: ["Imagery", "Photography", "Photo"],
    synonyms: ["photography", "bildsprache"],
  },
  {
    sectionType: "iconography",
    moduleId: "imagery",
    moduleIndex: 8,
    moduleLabel: "Imagery",
    subModuleLabel: "Iconography & Illustration Style",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "Asset grid uploader for Icon Set (SVG format) + stroke/fill inputs.",
    elementsView: "Direct icon set zip package download + individual raw SVG downloads.",
    presentationView: "Grid preview of vector icons with background contrast toggles.",
    promptTemplate: "Copies LLM instruction: \"Iconography Guidelines: Style: [Linear/Filled], Stroke Width: [Px], Primary Icon Color: [Hex].\"",
    renderer: "icon_set",
    eyebrow: "08.02 · Iconography & Illustration Style",
    defaultHeadline: "Iconography & Illustration Style",
    prefixes: ["Icons", "Iconography", "Illustration"],
    synonyms: ["icon", "illustration"],
  },
  {
    sectionType: "ai_image_prompts",
    moduleId: "imagery",
    moduleIndex: 8,
    moduleLabel: "Imagery",
    subModuleLabel: "AI Image Prompts",
    inputType: "Form / Text Input",
    tier: "CI Builder v2",
    adminEdit: "Reorderable prompt card array + Prompt Modifier inputs + Negative prompt inputs.",
    elementsView: "1-Click \"Copy Midjourney/Flux Prompt\" buttons per prompt block.",
    presentationView: "Dark-mode terminal prompt cards paired with generated image previews.",
    promptTemplate: "Copies LLM instruction: \"AI Generation Engine: Prompt Prefix: [Prefix]. Style Modifiers: [Modifiers]. Negative Prompts: [Negatives].\"",
    renderer: "prompt_cards",
    eyebrow: "08.03 · AI Image Prompts",
    defaultHeadline: "AI Image Prompts",
    prefixes: ["AIImage", "ImagePrompts"],
    synonyms: ["midjourney", "flux"],
  },
  {
    sectionType: "social_4x5",
    moduleId: "touchpoints",
    moduleIndex: 9,
    moduleLabel: "Touchpoints",
    subModuleLabel: "Social Media 4x5",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> slot + aspect ratio constraint validator (4:5).",
    elementsView: "High-res PNG template download + direct CDN image URL.",
    presentationView: "4:5 social post container card with full-screen zoom lightbox.",
    promptTemplate: "Copies LLM instruction: \"Social 4x5 Template Asset URL: [URL]. Aspect Ratio: 4:5 (1080x1350px). Follow strict brand padding.\"",
    renderer: "image_slot",
    eyebrow: "09.01 · Social Media 4x5",
    defaultHeadline: "Social Media 4x5",
    prefixes: ["Social", "Social4x5", "Applications"],
    synonyms: ["4x5", "instagram"],
  },
  {
    sectionType: "social_9x16",
    moduleId: "touchpoints",
    moduleIndex: 9,
    moduleLabel: "Touchpoints",
    subModuleLabel: "Social Media 9x16",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "<EditableImage> slot + aspect ratio constraint validator (9:16).",
    elementsView: "High-res PNG template download + direct CDN image URL.",
    presentationView: "9:16 mobile story mockup container with interactive frame overlay.",
    promptTemplate: "Copies LLM instruction: \"Social 9x16 Template Asset URL: [URL]. Aspect Ratio: 9:16 (1080x1920px). Safe zone clearance: [Px] top/bottom.\"",
    renderer: "image_slot",
    eyebrow: "09.02 · Social Media 9x16",
    defaultHeadline: "Social Media 9x16",
    prefixes: ["Social9x16", "Stories"],
    synonyms: ["9x16", "story"],
  },
  {
    sectionType: "email_signatures",
    moduleId: "touchpoints",
    moduleIndex: 9,
    moduleLabel: "Touchpoints",
    subModuleLabel: "Email Signatures",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "Rich text HTML template editor + avatar/logo image slot pickers.",
    elementsView: "Copyable raw HTML email signature code block.",
    presentationView: "Interactive live email client preview card (Desktop + Mobile view).",
    promptTemplate: "Copies LLM instruction: \"Email Signature Template HTML: [HTML Snippet]. Dynamic parameters: {name}, {title}, {phone}.\"",
    renderer: "email_sig",
    eyebrow: "09.03 · Email Signatures",
    defaultHeadline: "Email Signatures",
    prefixes: ["Email", "Signature"],
    synonyms: ["email signature"],
  },
  {
    sectionType: "presentation_deck",
    moduleId: "touchpoints",
    moduleIndex: 9,
    moduleLabel: "Touchpoints",
    subModuleLabel: "Presentation Deck",
    inputType: "Figma Frame Import",
    tier: "Optional",
    adminEdit: "Multi-slide image gallery manager (Cover, Section Divider, Content Slide).",
    elementsView: "Downloadable 16:9 presentation slide template package (PNG/PDF/Figma link).",
    presentationView: "Full-width deck presentation slide gallery with keyboard/arrow navigation.",
    promptTemplate: "Copies LLM instruction: \"Presentation Deck Guidelines: Aspect Ratio: 16:9. Cover Style: [Style]. Slide Background: [Hex].\"",
    renderer: "deck",
    eyebrow: "09.04 · Presentation Deck",
    defaultHeadline: "Presentation Deck",
    prefixes: ["Deck", "Presentation", "Slides"],
    synonyms: ["pitch deck", "slides"],
  },
];

export const CI_MODULES = Array.from(
  new Map(
    CI_SUBMODULES.map((s) => [
      s.moduleId,
      { id: s.moduleId, index: s.moduleIndex, label: s.moduleLabel },
    ])
  ).values()
).sort((a, b) => a.index - b.index);

export function getSubModule(sectionType: string | null | undefined): CiSubModuleDef | undefined {
  if (!sectionType) return undefined;
  return CI_SUBMODULES.find((s) => s.sectionType === sectionType);
}

export function submodulesForModule(moduleId: CiModuleId): CiSubModuleDef[] {
  return CI_SUBMODULES.filter((s) => s.moduleId === moduleId);
}

const CATALOG_ORDER = new Map(
  CI_SUBMODULES.map((s, index) => [s.sectionType, index])
);

/** Legacy section types sort after catalog sub-modules. */
const LEGACY_SECTION_ORDER: Record<string, number> = {
  overview: 9000,
  voice_tone: 9010,
  logo: 9020,
  colors: 9030,
  typography: 9040,
  grid_frames: 9050,
  buttons: 9060,
  backgrounds: 9070,
  imagery: 9080,
  applications: 9090,
  dos_donts: 9100,
};

export function catalogSortIndex(sectionType: string | null | undefined): number {
  if (!sectionType) return 99999;
  const catalogIdx = CATALOG_ORDER.get(sectionType as CiSubModuleId);
  if (catalogIdx !== undefined) return catalogIdx;
  return LEGACY_SECTION_ORDER[sectionType] ?? 9500;
}

/** Sort sections in canonical module / sub-module catalog order. */
export function sortSectionsByCatalog<
  T extends { section_type?: string | null; position?: number | null },
>(sections: T[]): T[] {
  return [...sections].sort((a, b) => {
    const ai = catalogSortIndex(a.section_type);
    const bi = catalogSortIndex(b.section_type);
    if (ai !== bi) return ai - bi;
    return (a.position ?? 0) - (b.position ?? 0);
  });
}

export function defaultDataForSubModule(sectionType: string): Record<string, unknown> {
  const def = getSubModule(sectionType);
  const kind = def?.renderer;
  switch (kind) {
    case "text":
      return { body: "" };
    case "claim_pitch":
      return { claim: "", pitch: "" };
    case "list":
      return { items: [] };
    case "archetype":
      return { archetype: "", traits: [] };
    case "dual_list":
      return { dos: [], donts: [] };
    case "sliders":
      return { axes: [
        { id: "formal_casual", left: "Formal", right: "Casual", value: 50 },
        { id: "punchy_detailed", left: "Punchy", right: "Detailed", value: 50 },
      ] };
    case "copy_examples":
      return { approved: [], forbidden: [] };
    case "code":
      return { prompt: "" };
    case "image_slot":
      return { assetId: "", label: "", stage: "light", caption: "", aspectRatio: "" };
    case "clearspace":
      return { multiplier: 1.5, assetId: "", notes: "" };
    case "image_dual":
      return { items: [] };
    case "color_group":
      return { swatches: [] };
    case "color_format":
      return { swatches: [] };
    case "color_scale":
      return { scales: [] };
    case "wcag":
      return { pairs: [] };
    case "type_spec":
      return { fontFamily: "", fontWeight: "", fontSize: "", lineHeight: "", letterSpacing: "", sampleText: "The quick brown fox" };
    case "font_stack":
      return { stack: "system-ui, -apple-system, sans-serif" };
    case "type_scale":
      return { scale: [] };
    case "type_tokens":
      return { tokens: [] };
    case "layout_grid":
      return { columns: 12, gutters: 24, margins: 32, maxWidth: 1440 };
    case "spacing":
      return { scale: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 } };
    case "ui_button":
      return { assetId: "", label: "Button", bg: "", text: "", border: "", radius: "", padding: "" };
    case "ui_states":
      return { states: [] };
    case "container_spec":
      return { bg: "", blur: "", border: "", radius: "", shadow: "", assetId: "" };
    case "icon_set":
      return { icons: [], strokeWidth: "", style: "linear", color: "" };
    case "prompt_cards":
      return { prompts: [] };
    case "email_sig":
      return { html: "", assetId: "" };
    case "deck":
      return { slides: [] };
    default:
      return {};
  }
}

