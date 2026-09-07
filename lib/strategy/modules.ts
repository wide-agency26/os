/** Shared module + strategy-type registry. Import this — do not hardcode keys elsewhere. */

export const MODULE_KEYS = [
  "audience-analysis",
  "competition-analysis",
  "market-analysis",
  "sentiment-analysis",
  "synthesis-positioning",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Import this in analyzer modules — do not redeclare the string. */
export const AUDIENCE_MODULE_KEY = MODULE_KEYS[0];
export const COMPETITION_MODULE_KEY = MODULE_KEYS[1];
export const MARKET_MODULE_KEY = MODULE_KEYS[2];
export const SENTIMENT_MODULE_KEY = MODULE_KEYS[3];
export const SYNTHESIS_MODULE_KEY = MODULE_KEYS[4];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  "audience-analysis": "Audience analysis",
  "competition-analysis": "Competition analysis",
  "market-analysis": "Market analysis",
  "sentiment-analysis": "Sentiment analysis",
  "synthesis-positioning": "Synthesis & positioning",
};

export const MODULE_BLURBS: Record<ModuleKey, string> = {
  "audience-analysis":
    "Who we are talking to, what they care about, and how we reach them.",
  "competition-analysis":
    "Who else occupies this space and where we can stand apart.",
  "market-analysis": "Category dynamics, demand, and the opening we can own.",
  "sentiment-analysis":
    "How the brand is perceived today — runs in the existing Sentiment tool.",
  "synthesis-positioning":
    "The positioning statement that falls out of the analyses above.",
};

export const STRATEGY_TYPES = [
  "business",
  "brand",
  "full-digital",
  "communication",
  "social-media",
  "social-commerce",
  "digital-chatbot",
  "advocacy",
  "retention",
  "website",
  "paid-media",
  "seo-search",
  "content",
  "go-to-market",
] as const;

export type StrategyType = (typeof STRATEGY_TYPES)[number];

export const STRATEGY_TYPE_LABELS: Record<StrategyType, string> = {
  business: "Business strategy",
  brand: "Brand strategy",
  "full-digital": "Full digital strategy",
  communication: "Communication strategy",
  "social-media": "Social media strategy",
  "social-commerce": "Social commerce strategy",
  "digital-chatbot": "Digital chatbot strategy",
  advocacy: "Advocacy strategy",
  retention: "Retention strategy",
  website: "Website strategy",
  "paid-media": "Paid media strategy",
  "seo-search": "SEO / search strategy",
  content: "Content strategy",
  "go-to-market": "Go-to-market strategy",
};

export const MODULE_STATUSES = ["not_started", "in_progress", "finalized"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

export const SCOPE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "hold",
  "active",
] as const;
export type ScopeStatus = (typeof SCOPE_STATUSES)[number];

export const STRATEGY_STATUSES = ["draft", "in_progress", "finalized"] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

/** Compact embed used by /builder and /share. Companion modules must match this. */
export type StrategyModuleCard = {
  moduleKey: ModuleKey;
  title: string;
  status: ModuleStatus;
  summary: string;
  href?: string;
  /** Audience Analysis: "3 of 3 segments finalized" */
  finalizedCount?: number;
  totalCount?: number;
  /** Finalized segments only on client surfaces. */
  segments?: { name: string; summary: string }[];
  /** Market Analysis: category + one-line takeaway, expandable body. */
  categoryLabel?: string;
  takeaway?: string;
  sections?: { label: string; text: string }[];
  /** Sentiment: top-line score/overall from /app/sentiment. */
  sentimentHeadline?: string;
  /** Synthesis: positioning statement headline, rationale on expand. */
  positioningStatement?: string;
  positioningRationale?: string;
  /** Competition: synthesis line + competitor names. */
  competitionLine?: string;
  competitionBody?: string;
  competitors?: { name: string; summary: string }[];
};

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

export function isStrategyType(value: string): value is StrategyType {
  return (STRATEGY_TYPES as readonly string[]).includes(value);
}

/** Default analyzers per strategy type (seed + reset). Admin can change in Playbooks. */
export const STRATEGY_TYPE_MODULE_DEFAULTS: {
  strategyType: StrategyType;
  moduleKey: ModuleKey;
  sortOrder: number;
}[] = [
  { strategyType: "brand", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "brand", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "brand", moduleKey: "market-analysis", sortOrder: 3 },
  { strategyType: "brand", moduleKey: "synthesis-positioning", sortOrder: 4 },
  { strategyType: "full-digital", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "full-digital", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "full-digital", moduleKey: "market-analysis", sortOrder: 3 },
  { strategyType: "full-digital", moduleKey: "sentiment-analysis", sortOrder: 4 },
  { strategyType: "full-digital", moduleKey: "synthesis-positioning", sortOrder: 5 },
  { strategyType: "business", moduleKey: "market-analysis", sortOrder: 1 },
  { strategyType: "business", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "business", moduleKey: "synthesis-positioning", sortOrder: 3 },
  { strategyType: "communication", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "communication", moduleKey: "sentiment-analysis", sortOrder: 2 },
  { strategyType: "communication", moduleKey: "synthesis-positioning", sortOrder: 3 },
  { strategyType: "social-media", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "social-media", moduleKey: "sentiment-analysis", sortOrder: 2 },
  { strategyType: "social-commerce", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "social-commerce", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "social-commerce", moduleKey: "sentiment-analysis", sortOrder: 3 },
  { strategyType: "digital-chatbot", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "advocacy", moduleKey: "sentiment-analysis", sortOrder: 1 },
  { strategyType: "advocacy", moduleKey: "audience-analysis", sortOrder: 2 },
  { strategyType: "retention", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "retention", moduleKey: "sentiment-analysis", sortOrder: 2 },
  { strategyType: "website", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "website", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "paid-media", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "paid-media", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "paid-media", moduleKey: "market-analysis", sortOrder: 3 },
  { strategyType: "seo-search", moduleKey: "competition-analysis", sortOrder: 1 },
  { strategyType: "seo-search", moduleKey: "market-analysis", sortOrder: 2 },
  { strategyType: "content", moduleKey: "audience-analysis", sortOrder: 1 },
  { strategyType: "content", moduleKey: "sentiment-analysis", sortOrder: 2 },
  { strategyType: "go-to-market", moduleKey: "market-analysis", sortOrder: 1 },
  { strategyType: "go-to-market", moduleKey: "competition-analysis", sortOrder: 2 },
  { strategyType: "go-to-market", moduleKey: "synthesis-positioning", sortOrder: 3 },
];

/** Catalog service names that a strategy type composes (matched to pm_services.name). */
export const STRATEGY_TYPE_SERVICE_NAMES: Record<StrategyType, string[]> = {
  business: ["Marketing Strategy", "Advance Analytics", "Campaign Planning"],
  brand: ["Brand Strategy", "Brand Guidelines", "Visual Identity"],
  "full-digital": [
    "Marketing Strategy",
    "SEO",
    "Social Media Content",
    "Paid Ads",
    "Website Design",
    "Website Development",
  ],
  communication: [
    "Messaging & Communitions",
    "Social Media Content",
    "CRM & Advocacy",
    "SEO",
    "Website Design",
  ],
  "social-media": ["Social Media Content"],
  "social-commerce": ["Social Media Content", "Paid Ads", "Website Design"],
  "digital-chatbot": ["Website Development", "Advance Analytics"],
  advocacy: ["CRM & Advocacy"],
  retention: ["CRM & Advocacy", "Advance Analytics"],
  website: ["Website Design", "Website Development"],
  "paid-media": ["Paid Ads", "Campaign Planning"],
  "seo-search": ["SEO"],
  content: ["Social Media Content", "Video Production"],
  "go-to-market": ["Marketing Strategy", "Campaign Planning", "Brand Strategy"],
};
