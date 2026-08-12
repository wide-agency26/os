export type BdSlideKind =
  | "title"
  | "service"
  | "portfolio"
  | "discovery"
  | "closing"
  | "custom";

export type BdSlidePortfolio = {
  source_url: string;
  link_url: string | null;
  title: string;
  caption: string | null;
  image_url: string | null;
  candidate_images: string[];
};

export type BdSlide = {
  id: string;
  kind: BdSlideKind;
  title: string;
  body: string;
  bullets: string[];
  service_id: string | null;
  portfolio: BdSlidePortfolio | null;
  sort_order: number;
};

export type BdSlideDeck = {
  id: string;
  bd_record_id: string | null;
  company_id: string | null;
  title: string;
  status: string;
  slides: BdSlide[];
  service_ids: string[];
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `slide_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function buildTemplatedSlides(input: {
  companyName: string;
  contactName?: string | null;
  services: { id: string; name: string; short_description: string | null }[];
  discoverySummary?: string | null;
  discoveryNeeds?: string | null;
  discoveryBudget?: string | null;
  discoveryTimeline?: string | null;
}): BdSlide[] {
  const slides: BdSlide[] = [
    {
      id: uid(),
      kind: "title",
      title: `Proposal for ${input.companyName}`,
      body: input.contactName
        ? `Prepared for ${input.contactName}`
        : "Prepared by WIDE",
      bullets: ["Strategy · Brand · Growth · Content · Website"],
      service_id: null,
      portfolio: null,
      sort_order: 0,
    },
  ];

  if (
    input.discoverySummary ||
    input.discoveryNeeds ||
    input.discoveryBudget ||
    input.discoveryTimeline
  ) {
    const bullets = [
      input.discoveryNeeds,
      input.discoveryBudget,
      input.discoveryTimeline,
    ].filter((x): x is string => Boolean(x));
    slides.push({
      id: uid(),
      kind: "discovery",
      title: "What we heard",
      body: input.discoverySummary || "Discovery call notes",
      bullets,
      service_id: null,
      portfolio: null,
      sort_order: slides.length,
    });
  }

  for (const svc of input.services) {
    slides.push({
      id: uid(),
      kind: "service",
      title: svc.name,
      body: svc.short_description || `How WIDE delivers ${svc.name}.`,
      bullets: [
        "Scope framed around your outcomes",
        "Clear milestones and decision points",
        "Pricing packaged for this engagement",
      ],
      service_id: svc.id,
      portfolio: null,
      sort_order: slides.length,
    });
  }

  slides.push({
    id: uid(),
    kind: "portfolio",
    title: "Selected work",
    body: "Paste a wide-communication.com/project URL to pull a case study.",
    bullets: [],
    service_id: null,
    portfolio: {
      source_url: "",
      link_url: null,
      title: "",
      caption: null,
      image_url: null,
      candidate_images: [],
    },
    sort_order: slides.length,
  });

  slides.push({
    id: uid(),
    kind: "closing",
    title: "Next step",
    body: "Accept this proposal to move into contract, or tell us what to adjust.",
    bullets: ["Accept", "Hold", "Decline with reason"],
    service_id: null,
    portfolio: null,
    sort_order: slides.length,
  });

  return slides;
}

export function normalizeSlides(raw: unknown): BdSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => {
    const o = (item || {}) as Record<string, unknown>;
    const kind = (typeof o.kind === "string" ? o.kind : "custom") as BdSlideKind;
    const portfolioRaw =
      o.portfolio && typeof o.portfolio === "object"
        ? (o.portfolio as Record<string, unknown>)
        : null;
    return {
      id: typeof o.id === "string" ? o.id : uid(),
      kind,
      title: typeof o.title === "string" ? o.title : `Slide ${idx + 1}`,
      body: typeof o.body === "string" ? o.body : "",
      bullets: Array.isArray(o.bullets)
        ? o.bullets.filter((b): b is string => typeof b === "string")
        : [],
      service_id: typeof o.service_id === "string" ? o.service_id : null,
      portfolio: portfolioRaw
        ? {
            source_url:
              typeof portfolioRaw.source_url === "string"
                ? portfolioRaw.source_url
                : "",
            link_url:
              typeof portfolioRaw.link_url === "string"
                ? portfolioRaw.link_url
                : null,
            title:
              typeof portfolioRaw.title === "string"
                ? portfolioRaw.title
                : "",
            caption:
              typeof portfolioRaw.caption === "string"
                ? portfolioRaw.caption
                : null,
            image_url:
              typeof portfolioRaw.image_url === "string"
                ? portfolioRaw.image_url
                : null,
            candidate_images: Array.isArray(portfolioRaw.candidate_images)
              ? portfolioRaw.candidate_images.filter(
                  (u): u is string => typeof u === "string"
                )
              : [],
          }
        : null,
      sort_order:
        typeof o.sort_order === "number" ? o.sort_order : idx,
    };
  });
}
