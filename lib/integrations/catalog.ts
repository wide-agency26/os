/**
 * Canonical map of every external system WIDE OS talks to (or should).
 * Status is computed server-side from env *presence* and OAuth row counts —
 * never from secret values.
 */

export type IntegrationGroup =
  | "google"
  | "meta"
  | "linkedin"
  | "design"
  | "finance"
  | "ai"
  | "signals"
  | "platform";

export type IntegrationMaturity = "live" | "partial" | "planned" | "internal";

export type KeyNeed = {
  name: string;
  required: boolean;
  /** When set, this key is satisfied if any name in the group is present. */
  anyOf?: string[];
  note?: string;
};

export type IntegrationDef = {
  id: string;
  name: string;
  group: IntegrationGroup;
  maturity: IntegrationMaturity;
  summary: string;
  usedBy: string[];
  how: string;
  keys: KeyNeed[];
  /** OAuth / account bind, not an env var. */
  oauth?: "google_workspace" | "google_ads" | "youtube" | "meta" | "figma";
  connectHref?: string;
  buriedHref?: string;
  buriedLabel?: string;
};

export const INTEGRATION_GROUPS: { id: IntegrationGroup; label: string; blurb: string }[] = [
  {
    id: "google",
    label: "Google",
    blurb: "One Cloud app (GOOGLE_CLIENT_ID / SECRET) unlocks Gmail, Calendar, Analytics, Search Console. Ads and YouTube use extra consent. Drive is not in the current scopes yet.",
  },
  {
    id: "meta",
    label: "Meta",
    blurb: "Instagram + Ads for reports today. Publishing into the Content Calendar is the next bind. App ID/secret can be WIDE-wide (env) or per-client (encrypted).",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    blurb: "Reports currently take CSV dumps. A live Marketing API + posting for Content Calendar is not wired.",
  },
  {
    id: "design",
    label: "Design & web",
    blurb: "Figma feeds CI Builder. Webflow is the usual client CMS/host — not connected yet.",
  },
  {
    id: "finance",
    label: "Finance",
    blurb: "Lexware is the German books/quotation system already stubbed in Work → Quotes.",
  },
  {
    id: "ai",
    label: "AI & knowledge",
    blurb: "Vercel AI Gateway powers generation across the OS. Context Bank is the internal write/read layer — no vendor key.",
  },
  {
    id: "signals",
    label: "Data banks & signals",
    blurb: "Inputs that should feed Context Bank, Strategy, SEO, and report insights. None of these vendors are live except what we already pull from GSC/GA4/Meta.",
  },
  {
    id: "platform",
    label: "Platform",
    blurb: "Runtime, cron, encryption, inbound email. Secrets stay in Vercel — this page only shows whether they exist.",
  },
];

const GOOGLE_OAUTH: KeyNeed[] = [
  { name: "GOOGLE_CLIENT_ID", required: true },
  { name: "GOOGLE_CLIENT_SECRET", required: true },
];

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "gmail",
    name: "Gmail",
    group: "google",
    maturity: "partial",
    summary: "Read-only inbox via Google Workspace OAuth. Used as context for PM email-to-task and Google context pulls — not sending mail.",
    usedBy: ["PM inbound review", "Google workspace context"],
    how: "Connect Google Workspace (consent includes gmail.readonly). Sending mail is not in scope yet.",
    keys: GOOGLE_OAUTH,
    oauth: "google_workspace",
    connectHref: "/api/integrations/google/connect?intent=workspace&next=/app/settings/connections",
    buriedHref: "/app/projects/settings",
    buriedLabel: "Project settings",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    group: "google",
    maturity: "partial",
    summary: "Read-only calendar on the same Workspace OAuth. A default meeting URL can be set for client-manager cards.",
    usedBy: ["Client manager profile", "Workspace context"],
    how: "Same Google Workspace connect. Optional NEXT_PUBLIC_DEFAULT_GOOGLE_CALENDAR_URL for a booking link.",
    keys: [
      ...GOOGLE_OAUTH,
      { name: "NEXT_PUBLIC_DEFAULT_GOOGLE_CALENDAR_URL", required: false, note: "Public booking link, not a secret." },
    ],
    oauth: "google_workspace",
    connectHref: "/api/integrations/google/connect?intent=workspace&next=/app/settings/connections",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    group: "google",
    maturity: "planned",
    summary: "Not in the current OAuth scopes. Needed so Context Bank and CI/content can pull briefs, decks, and brand files without a second upload pile.",
    usedBy: ["Context Bank (planned)", "CI Builder (planned)", "Content (planned)"],
    how: "Add drive.readonly (or drive.file) to the Workspace OAuth scopes, reconnect, then store file refs as document_ref entries.",
    keys: GOOGLE_OAUTH,
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    group: "google",
    maturity: "live",
    summary: "Live website reports. Connect per project on Report Sources after Workspace OAuth.",
    usedBy: ["Client reports", "Report sync"],
    how: "Connect Google Workspace, then bind a GA4 property on the project’s Sources page.",
    keys: GOOGLE_OAUTH,
    oauth: "google_workspace",
    connectHref: "/api/integrations/google/connect?intent=workspace&next=/app/projects/report-data",
    buriedHref: "/app/projects/report-data",
    buriedLabel: "Report Sources",
  },
  {
    id: "gsc",
    name: "Google Search Console",
    group: "google",
    maturity: "live",
    summary: "Queries/pages/devices for reports and the SEO auditor.",
    usedBy: ["Client reports", "SEO auditor"],
    how: "Same Workspace OAuth (webmasters.readonly). Bind the site on Sources and/or SEO.",
    keys: GOOGLE_OAUTH,
    oauth: "google_workspace",
    connectHref: "/api/integrations/google/connect?intent=workspace&next=/app/projects/report-data",
    buriedHref: "/app/seo",
    buriedLabel: "SEO",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    group: "google",
    maturity: "partial",
    summary: "Live ads pull needs the developer token in addition to OAuth. Without the token, connect UI still works but API calls fail.",
    usedBy: ["Client reports · Ads"],
    how: "Set GOOGLE_ADS_DEVELOPER_TOKEN (Ads API Center), then connect via the Google Ads popup on Sources.",
    keys: [
      ...GOOGLE_OAUTH,
      { name: "GOOGLE_ADS_DEVELOPER_TOKEN", required: true, note: "From Google Ads API Center, not the Cloud OAuth client." },
    ],
    oauth: "google_ads",
    connectHref: "/api/integrations/google/connect?intent=google_ads&popup=1&next=/app/projects/report-data",
    buriedHref: "/app/projects/report-data",
    buriedLabel: "Report Sources",
  },
  {
    id: "youtube",
    name: "YouTube",
    group: "google",
    maturity: "live",
    summary: "Organic channel analytics. Opens an account picker so you can use the channel’s Google account, not the WIDE inbox.",
    usedBy: ["Client reports · Social"],
    how: "Connect from Report Sources (popup). Same Cloud OAuth client.",
    keys: GOOGLE_OAUTH,
    oauth: "youtube",
    connectHref: "/api/integrations/google/connect?intent=youtube&popup=1&next=/app/projects/report-data",
    buriedHref: "/app/projects/report-data",
    buriedLabel: "Report Sources",
  },
  {
    id: "pagespeed",
    name: "PageSpeed Insights",
    group: "google",
    maturity: "partial",
    summary: "Core Web Vitals in the SEO auditor. Free quota; key lives in Vercel.",
    usedBy: ["SEO auditor"],
    how: "Create a Google Cloud API key with PageSpeed Insights API enabled. Set PAGESPEED_API_KEY.",
    keys: [{ name: "PAGESPEED_API_KEY", required: true }],
    buriedHref: "/app/seo",
    buriedLabel: "SEO",
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    group: "meta",
    maturity: "live",
    summary: "Campaign/ad-set performance for client reports. App credentials: env fallback or per-client encrypted row.",
    usedBy: ["Client reports · Ads"],
    how: "Save App ID + secret (WIDE env or per-client on Sources), then OAuth with ads_read.",
    keys: [
      { name: "META_APP_ID", required: false, note: "WIDE-wide fallback. Per-client apps are stored encrypted." },
      { name: "META_APP_SECRET", required: false },
      { name: "CREDENTIALS_ENCRYPTION_KEY", required: true, note: "AES-256-GCM for per-client Meta secrets. 32 bytes / 64 hex chars." },
    ],
    oauth: "meta",
    buriedHref: "/app/projects/report-data",
    buriedLabel: "Report Sources",
  },
  {
    id: "meta_ig",
    name: "Instagram (Meta)",
    group: "meta",
    maturity: "live",
    summary: "Organic IG insights via the same Meta OAuth (instagram_basic + instagram_manage_insights).",
    usedBy: ["Client reports · Social"],
    how: "Same Meta connect as Ads. Bind the IG account on Sources.",
    keys: [
      { name: "META_APP_ID", required: false },
      { name: "META_APP_SECRET", required: false },
      { name: "CREDENTIALS_ENCRYPTION_KEY", required: true },
    ],
    oauth: "meta",
    buriedHref: "/app/projects/report-data",
    buriedLabel: "Report Sources",
  },
  {
    id: "meta_publish",
    name: "Meta publishing (Content Calendar)",
    group: "meta",
    maturity: "planned",
    summary: "Scheduling/publishing posts into IG/FB from the Content Calendar. Read insights are live; write is not.",
    usedBy: ["Content Calendar"],
    how: "Extend Meta OAuth with pages_manage_posts / instagram_content_publish and a publisher in the calendar.",
    keys: [
      { name: "META_APP_ID", required: false },
      { name: "META_APP_SECRET", required: false },
    ],
    buriedHref: "/app/tools/content",
    buriedLabel: "Content",
  },
  {
    id: "linkedin_reports",
    name: "LinkedIn reports",
    group: "linkedin",
    maturity: "partial",
    summary: "Organic + Ads land via CSV on Report Sources. No Marketing API token yet.",
    usedBy: ["Client reports · Social / Ads"],
    how: "Today: upload LinkedIn exports. Later: LinkedIn Marketing API (Community Management + Ads).",
    keys: [
      { name: "LINKEDIN_CLIENT_ID", required: false, note: "Not used yet — needed for live OAuth." },
      { name: "LINKEDIN_CLIENT_SECRET", required: false },
    ],
    buriedHref: "/app/projects/report-data",
    buriedLabel: "Report Sources",
  },
  {
    id: "linkedin_publish",
    name: "LinkedIn publishing",
    group: "linkedin",
    maturity: "planned",
    summary: "Posting from Content Calendar to company pages. Not built.",
    usedBy: ["Content Calendar"],
    how: "LinkedIn Community Management API + org admin OAuth.",
    keys: [
      { name: "LINKEDIN_CLIENT_ID", required: false },
      { name: "LINKEDIN_CLIENT_SECRET", required: false },
    ],
    buriedHref: "/app/tools/content",
    buriedLabel: "Content",
  },
  {
    id: "figma",
    name: "Figma",
    group: "design",
    maturity: "live",
    summary: "CI Builder import: OAuth app or a personal access token pasted in the wizard.",
    usedBy: ["CI Builder"],
    how: "Set FIGMA_CLIENT_ID / SECRET (Figma → My Apps). Connect from CI Builder, or paste a PAT if OAuth isn’t set.",
    keys: [
      { name: "FIGMA_CLIENT_ID", required: true },
      { name: "FIGMA_CLIENT_SECRET", required: true },
    ],
    oauth: "figma",
    connectHref: "/api/ci-builder/figma/oauth/start?return_to=/app/settings/connections",
    buriedHref: "/app/tools/ci",
    buriedLabel: "CI Builder",
  },
  {
    id: "webflow",
    name: "Webflow",
    group: "design",
    maturity: "planned",
    summary: "Most WIDE marketing sites ship on Webflow. Needed for CMS publish, style snapshots, and later blog/content push.",
    usedBy: ["CI / Web style guide (planned)", "Blog (planned)", "Content (planned)"],
    how: "Webflow Data API v2 site token or OAuth app. Site-level token is enough for a first bind.",
    keys: [
      { name: "WEBFLOW_CLIENT_ID", required: false, note: "OAuth app — or a per-site API token once we add the bind UI." },
      { name: "WEBFLOW_CLIENT_SECRET", required: false },
    ],
  },
  {
    id: "lexware",
    name: "Lexware",
    group: "finance",
    maturity: "partial",
    summary: "Quotations and contact sync are implemented; they stay ‘coming soon’ until LEXWARE_API_KEY is set. Webhook confirms accepted quotes.",
    usedBy: ["Work · Quotes", "BD quotation"],
    how: "Lexware Office public API key in Vercel. Optional webhook secret for /api/lexware/webhook.",
    keys: [
      { name: "LEXWARE_API_KEY", required: true },
      { name: "LEXWARE_WEBHOOK_SECRET", required: false, note: "Verify inbound quote events." },
      { name: "LEXWARE_API_BASE_URL", required: false, note: "Defaults to https://api.lexware.io" },
      { name: "LEXWARE_APP_BASE_URL", required: false, note: "Defaults to https://app.lexware.de" },
    ],
    buriedHref: "/app/work/quotes",
    buriedLabel: "Quotes",
  },
  {
    id: "ai_gateway",
    name: "AI gateway",
    group: "ai",
    maturity: "live",
    summary: "One path for every generate call: Vercel AI Gateway (OIDC on Vercel, or AI_GATEWAY_API_KEY locally). Never send keys to the browser.",
    usedBy: [
      "Audience Analysis",
      "Market Analysis",
      "Competition Analysis",
      "Synthesis / positioning",
      "Deal Finder",
      "Content Calendar",
      "Blog Builder",
      "SEO synthesizer",
      "Report insights",
      "CI extract",
      "Context Bank digest",
      "SOW assist",
    ],
    how: "On Vercel, OIDC authenticates automatically. Locally run `vercel env pull .env.local`. Optional AI_MODEL override (provider/model).",
    keys: [
      {
        name: "VERCEL_OIDC_TOKEN",
        required: true,
        anyOf: ["VERCEL_OIDC_TOKEN", "AI_GATEWAY_API_KEY"],
        note: "OIDC is automatic on Vercel. Any one of these satisfies AI.",
      },
      { name: "AI_GATEWAY_API_KEY", required: false, note: "Static key if OIDC is unavailable." },
      { name: "AI_MODEL", required: false, note: "e.g. openai/gpt-5.4-mini (free-tier default) or openai/gpt-5.5 after topping up credits" },
    ],
  },
  {
    id: "context_bank",
    name: "Context Bank",
    group: "ai",
    maturity: "internal",
    summary: "Company/project knowledge feed. Modules write on finalize; digests roll up. No vendor key.",
    usedBy: [
      "Audience finalize",
      "Market finalize",
      "Competition finalize",
      "Synthesis finalize",
    ],
    how: "Staff notes on the CRM company record and project overview. logToContextBank() from any module.",
    keys: [],
    buriedHref: "/app/crm",
    buriedLabel: "CRM company",
  },
  {
    id: "trends",
    name: "Trend & market signals",
    group: "signals",
    maturity: "planned",
    summary: "Google Trends, news/RSS, and a research API (DataForSEO / similar) should land in Context Bank for Strategy, SEO, and report insights.",
    usedBy: ["Strategy (planned)", "SEO (planned)", "Report insights (planned)"],
    how: "Start with Google Trends (no key) + RSS. Add DataForSEO or Ahrefs when we want keyword/SERP volume at scale.",
    keys: [
      { name: "DATAFORSEO_LOGIN", required: false, note: "Not wired." },
      { name: "DATAFORSEO_PASSWORD", required: false },
      { name: "AHREFS_API_TOKEN", required: false, note: "Not wired. Alternative to DataForSEO." },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    group: "signals",
    maturity: "planned",
    summary: "Not connected. Needed if we report or publish TikTok the same way as IG.",
    usedBy: ["Reports (planned)", "Content Calendar (planned)"],
    how: "TikTok Display / Content Posting APIs + Business Center app.",
    keys: [
      { name: "TIKTOK_CLIENT_KEY", required: false },
      { name: "TIKTOK_CLIENT_SECRET", required: false },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    group: "platform",
    maturity: "internal",
    summary: "Database, auth, storage. Already required to boot the OS.",
    usedBy: ["Entire OS"],
    how: "Vercel env. Publishable key is public; service role must never be NEXT_PUBLIC.",
    keys: [
      { name: "NEXT_PUBLIC_SUPABASE_URL", required: true },
      { name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", required: false, anyOf: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
      { name: "SUPABASE_SERVICE_ROLE_KEY", required: false, anyOf: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"] },
    ],
  },
  {
    id: "cron",
    name: "Cron & workers",
    group: "platform",
    maturity: "internal",
    summary: "Vercel Cron hits /api/cron/* with x-vercel-cron. Manual/retry calls need CRON_SECRET.",
    usedBy: ["SEO sweeper", "Blog scrape", "Context digest", "Lexware quotation poll", "Deal Finder"],
    how: "Set CRON_SECRET (and optional SEO_WORKER_SECRET). vercel.json already lists the schedules.",
    keys: [
      { name: "CRON_SECRET", required: true },
      { name: "SEO_WORKER_SECRET", required: false, note: "Falls back to CRON_SECRET." },
    ],
  },
  {
    id: "mcp",
    name: "Agency MCP (bot)",
    group: "platform",
    maturity: "live",
    summary:
      "One Streamable HTTP MCP server for the whole OS: clients → projects → tasks + Debug center. Write-on-command only.",
    usedBy: ["Agency bot", "Cursor / Claude remote MCP"],
    how: "Set MCP_API_KEY in Vercel. Connect clients to https://os.wide-communication.com/api/mcp with Authorization: Bearer <key>.",
    keys: [{ name: "MCP_API_KEY", required: true, note: "Dedicated secret — do not reuse CRON_SECRET." }],
    buriedHref: "/app/settings/pm",
    buriedLabel: "PM task policy",
  },
  {
    id: "pm_inbound",
    name: "Inbound email → tasks",
    group: "platform",
    maturity: "live",
    summary: "Per-project alias; webhook posts into the review queue. Nothing becomes a live task without a human.",
    usedBy: ["PM review queue"],
    how: "Point the mail provider webhook at POST /api/pm/email-inbound with Bearer PM_INBOUND_WEBHOOK_SECRET.",
    keys: [
      { name: "PM_INBOUND_WEBHOOK_SECRET", required: true },
      { name: "NEXT_PUBLIC_PM_INBOUND_DOMAIN", required: false, note: "Defaults to pm.wide.agency" },
    ],
    buriedHref: "/app/settings/integrations",
    buriedLabel: "Inbound aliases",
  },
  {
    id: "encryption",
    name: "Credential encryption",
    group: "platform",
    maturity: "partial",
    summary: "Encrypts per-client Meta app secrets at rest. Without it, only the WIDE-wide META_APP_* env fallback works.",
    usedBy: ["Meta per-client apps"],
    how: "32-byte key as 64 hex chars in CREDENTIALS_ENCRYPTION_KEY. Generate once, store only in Vercel.",
    keys: [{ name: "CREDENTIALS_ENCRYPTION_KEY", required: true }],
  },
  {
    id: "site",
    name: "Site & PDF",
    group: "platform",
    maturity: "internal",
    summary: "Canonical URL for OAuth redirects and print. PDF token is derived if PDF_PRINT_SECRET is unset.",
    usedBy: ["OAuth callbacks", "Public guideline/report URLs", "PDF export"],
    how: "NEXT_PUBLIC_SITE_URL should be https://os.wide-communication.com (or the custom domain).",
    keys: [
      { name: "NEXT_PUBLIC_SITE_URL", required: true },
      { name: "PDF_PRINT_SECRET", required: false },
    ],
  },
  {
    id: "escalation",
    name: "Client escalation webhook",
    group: "platform",
    maturity: "partial",
    summary: "When a client escalates a report question, optionally POST to Slack/Make/etc.",
    usedBy: ["Client reports · Ask AI"],
    how: "Set CLIENT_ESCALATION_WEBHOOK_URL to an HTTPS endpoint.",
    keys: [{ name: "CLIENT_ESCALATION_WEBHOOK_URL", required: false }],
  },
];

export function uniqueKeyNames(): string[] {
  const set = new Set<string>();
  for (const item of INTEGRATIONS) {
    for (const k of item.keys) set.add(k.name);
    for (const k of item.keys) (k.anyOf || []).forEach((n) => set.add(n));
  }
  return Array.from(set).sort();
}
