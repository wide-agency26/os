export const CLIENT_REQUEST_SERVICES = [
  "Advance Analytics",
  "Brand Guidelines",
  "Brand Strategy",
  "CRM & Advocacy",
  "Campaign Planning",
  "Marketing Strategy",
  "Messaging & Communitions",
  "Paid Ads",
  "SEO",
  "Social Media Content",
  "Video Production",
  "Visual Identity",
  "Website Design",
  "Website Development",
] as const;

export type ClientRequestService = (typeof CLIENT_REQUEST_SERVICES)[number];

export type ServiceField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "url" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export const SERVICE_FIELD_CONFIG: Record<ClientRequestService, ServiceField[]> = {
  "Advance Analytics": [
    { name: "data_sources", label: "Data sources / tools", type: "textarea", required: true },
    { name: "kpis", label: "KPIs you want to track", type: "textarea", required: true },
    { name: "reporting_cadence", label: "Reporting cadence", type: "select", options: ["Weekly", "Monthly", "Quarterly", "One-off"] },
  ],
  "Brand Guidelines": [
    { name: "deliverable_scope", label: "What should the guidelines cover?", type: "textarea", required: true },
    { name: "existing_assets", label: "Link to existing brand assets", type: "url" },
  ],
  "Brand Strategy": [
    { name: "business_goal", label: "Primary business goal", type: "textarea", required: true },
    { name: "audience", label: "Target audience", type: "textarea", required: true },
    { name: "competitors", label: "Key competitors", type: "textarea" },
  ],
  "CRM & Advocacy": [
    { name: "crm_platform", label: "CRM platform (if any)", type: "text" },
    { name: "program_goal", label: "Program goal", type: "textarea", required: true },
  ],
  "Campaign Planning": [
    { name: "campaign_name", label: "Campaign / initiative name", type: "text", required: true },
    { name: "channels", label: "Channels in scope", type: "textarea", required: true },
    { name: "launch_window", label: "Target launch window", type: "text" },
  ],
  "Marketing Strategy": [
    { name: "objective", label: "Marketing objective", type: "textarea", required: true },
    { name: "budget_range", label: "Budget range (optional)", type: "text" },
  ],
  "Messaging & Communitions": [
    { name: "channels", label: "Channels (email, PR, social, etc.)", type: "textarea", required: true },
    { name: "key_message", label: "Key message or announcement", type: "textarea", required: true },
  ],
  "Paid Ads": [
    { name: "platforms", label: "Ad platforms", type: "text", required: true, placeholder: "Meta, Google, LinkedIn…" },
    { name: "monthly_budget", label: "Monthly budget", type: "text" },
    { name: "landing_url", label: "Landing page URL", type: "url" },
  ],
  SEO: [
    { name: "site_url", label: "Website URL", type: "url", required: true },
    { name: "focus_keywords", label: "Priority keywords / topics", type: "textarea", required: true },
  ],
  "Social Media Content": [
    { name: "platforms", label: "Platforms", type: "text", required: true },
    { name: "content_types", label: "Content types needed", type: "textarea", required: true },
    { name: "posting_frequency", label: "Posting frequency", type: "select", options: ["Daily", "3×/week", "Weekly", "Campaign burst"] },
  ],
  "Video Production": [
    { name: "video_type", label: "Video type", type: "select", options: ["Brand film", "Social cutdowns", "Testimonial", "Product demo", "Other"], required: true },
    { name: "duration", label: "Target duration", type: "text" },
    { name: "references", label: "Reference links", type: "textarea" },
  ],
  "Visual Identity": [
    { name: "scope", label: "Scope (logo, palette, type, etc.)", type: "textarea", required: true },
    { name: "inspiration", label: "Inspiration / references", type: "textarea" },
  ],
  "Website Design": [
    { name: "site_url", label: "Current site (if any)", type: "url" },
    { name: "page_count", label: "Approx. pages / templates", type: "text", required: true },
    { name: "must_have_features", label: "Must-have features", type: "textarea" },
  ],
  "Website Development": [
    { name: "site_url", label: "Design / Figma link or current site", type: "url" },
    { name: "platform", label: "Platform preference", type: "select", options: ["Webflow", "WordPress", "Next.js", "Shopify", "Unsure"] },
    { name: "integrations", label: "Integrations needed", type: "textarea" },
  ],
};

export function isClientRequestService(value: string): value is ClientRequestService {
  return (CLIENT_REQUEST_SERVICES as readonly string[]).includes(value);
}
