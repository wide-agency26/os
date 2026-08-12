export type SowStatus = "draft" | "published" | "accepted" | "archived";
export type SowCategory =
  | "strategy"
  | "brand"
  | "growth"
  | "content"
  | "website"
  | "custom";
export type SowPortrayal =
  | "narrative"
  | "channel_cards"
  | "quantity_cadence"
  | "phased";

export type SowTheme = {
  fontFamily:
    | "Syne"
    | "Space Grotesk"
    | "DM Sans"
    | "Instrument Sans"
    | "Manrope";
  background: string;
  text: string;
  mutedText: string;
  accent: string;
  cardBg: string;
  border: string;
};

export type SowVat = {
  enabled: boolean;
  rate: number;
  /** Placeholders: {{subtotal}}, {{rate}}, {{vat}}, {{total}} */
  wording: string;
};

export type PmService = {
  id: string;
  name: string;
  category: SowCategory;
  sort_order: number;
  description: string | null;
  short_description: string | null;
};

export type PmPackage = {
  id: string;
  name: string;
  cadence_type: string;
  high_level_process: string[] | null;
  sort_order: number;
};

export type SowLineItemTemplate = {
  id: string;
  service_id: string;
  title: string;
  description: string | null;
  is_recurring: boolean;
  requires_quantity: boolean;
  quantity_placeholder: string | null;
  uses_revision_rounds: boolean;
  is_gate_note: boolean;
  sort_order: number;
};

export type SowLineItem = {
  id: string;
  sow_id: string;
  section_id: string;
  service_id: string | null;
  template_id: string | null;
  title: string;
  description: string | null;
  is_manual: boolean;
  price: number | null;
  original_price: number | null;
  cost_group_id: string | null;
  quantity_label: string | null;
  requires_quantity: boolean;
  cadence: string | null;
  is_recurring: boolean;
  uses_revision_rounds: boolean;
  is_gate_note: boolean;
  sort_order: number;
};

export type SowCostGroup = {
  id: string;
  sow_id: string;
  title: string;
  price: number;
  sort_order: number;
};

export type SowSection = {
  id: string;
  sow_id: string;
  category: SowCategory;
  title: string;
  portrayal: SowPortrayal;
  intro: string | null;
  service_id: string | null;
  service_name_snapshot: string | null;
  service_description_snapshot: string | null;
  service_short_description_snapshot: string | null;
  sort_order: number;
  line_items: SowLineItem[];
};

export type SowPortfolioSlide = {
  id: string;
  sow_id: string;
  source_url: string;
  link_url: string | null;
  title: string;
  caption: string | null;
  image_url: string | null;
  candidate_images: string[];
  category_tags: string[];
  slide_kind: "scraped" | "screenshot";
  sort_order: number;
};

export type SowRecord = {
  id: string;
  company_id: string;
  project_id: string | null;
  title: string;
  status: SowStatus;
  package_id: string | null;
  revision_rounds: number;
  terms_text: string;
  intro_narrative: string | null;
  show_conservative_block: boolean;
  conservative_eyebrow: string;
  conservative_body: string;
  document_date: string;
  theme: SowTheme;
  vat: SowVat;
  public_slug: string | null;
  currency: string;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SowDocument = SowRecord & {
  sections: SowSection[];
  cost_groups: SowCostGroup[];
  portfolio_slides: SowPortfolioSlide[];
  company?: {
    id: string;
    name: string | null;
    company: string | null;
    status: string | null;
  };
  project?: {
    id: string;
    title: string;
    stage: string | null;
    client_id: string | null;
  } | null;
  package?: { id: string; name: string } | null;
};
