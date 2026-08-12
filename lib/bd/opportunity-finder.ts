export type DiscoverySignalSource =
  | "funding"
  | "rebrand"
  | "job_posting"
  | "directory"
  | "rfp";

export type DiscoveryConfig = {
  keywords: string[];
  industries: string[];
  geographies: string[];
  sources: DiscoverySignalSource[];
  updated_at: string | null;
};

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  keywords: [
    "rebrand",
    "series a",
    "seed",
    "brand designer",
    "head of marketing",
    "launch",
  ],
  industries: [
    "SaaS",
    "Fintech",
    "Climate",
    "Healthtech",
    "Consumer",
    "Marketplace",
  ],
  geographies: ["Munich", "Berlin", "DACH", "Germany", "Austria", "Switzerland"],
  sources: ["funding", "rebrand", "job_posting", "directory", "rfp"],
  updated_at: null,
};

export type DiscoveredSignal = {
  id: string;
  source: DiscoverySignalSource;
  company_name: string;
  contact_name: string | null;
  role: string | null;
  signal_summary: string;
  signal_url: string | null;
  geography: string | null;
  industry: string | null;
};

export type WarmIntroPath = {
  contact_id: string;
  contact_name: string;
  company_name: string | null;
  reason: string;
  strength: "strong" | "possible";
};

/** Curated demo signals for self-test without external scrapers. */
export function sampleDiscoverySignals(
  config: DiscoveryConfig
): DiscoveredSignal[] {
  const all: DiscoveredSignal[] = [
    {
      id: "sig_alpine_seed",
      source: "funding",
      company_name: "Alpine Grid Energy",
      contact_name: "Lena Vogt",
      role: "CEO",
      signal_summary: "Seed round announced — climate SaaS, Munich HQ.",
      signal_url: null,
      geography: "Munich",
      industry: "Climate",
    },
    {
      id: "sig_nordlicht_rebrand",
      source: "rebrand",
      company_name: "Nordlicht Robotics",
      contact_name: "Maya Keller",
      role: "Head of Brand",
      signal_summary: "Public rebrand / site relaunch rumoured for Q4.",
      signal_url: null,
      geography: "Munich",
      industry: "SaaS",
    },
    {
      id: "sig_bau_job",
      source: "job_posting",
      company_name: "Bauconsult",
      contact_name: null,
      role: "Brand Designer (hiring)",
      signal_summary: "Hiring Brand Designer — signals in-house brand build-out.",
      signal_url: null,
      geography: "Munich",
      industry: "Marketplace",
    },
    {
      id: "sig_fintech_rfp",
      source: "rfp",
      company_name: "Rhein Ledger",
      contact_name: "Tom Berger",
      role: "CMO",
      signal_summary: "Public RFP for brand + website (DACH fintech).",
      signal_url: null,
      geography: "Berlin",
      industry: "Fintech",
    },
  ];

  return all.filter((s) => {
    if (!config.sources.includes(s.source)) return false;
    if (
      config.geographies.length &&
      s.geography &&
      !config.geographies.some((g) =>
        s.geography!.toLowerCase().includes(g.toLowerCase())
      )
    ) {
      return false;
    }
    if (
      config.industries.length &&
      s.industry &&
      !config.industries.some(
        (i) => i.toLowerCase() === s.industry!.toLowerCase()
      )
    ) {
      // keep if industry filter empty match — still allow when industry listed loosely
      const hit = config.industries.some((i) =>
        (s.industry || "").toLowerCase().includes(i.toLowerCase())
      );
      if (!hit) return false;
    }
    return true;
  });
}

export function scoreWarmIntros(
  signal: DiscoveredSignal,
  network: {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    record_kind: string | null;
  }[]
): WarmIntroPath[] {
  const paths: WarmIntroPath[] = [];
  const companyNeedle = signal.company_name.toLowerCase();
  const industry = (signal.industry || "").toLowerCase();

  for (const n of network) {
    const co = (n.company || "").toLowerCase();
    const name = (n.name || "").toLowerCase();
    if (!co && !name) continue;

    if (co && (co.includes(companyNeedle) || companyNeedle.includes(co))) {
      paths.push({
        contact_id: n.id,
        contact_name: n.name,
        company_name: n.company,
        reason: `Same / overlapping company name in CRM (${n.company}).`,
        strength: "strong",
      });
      continue;
    }

    if (
      industry &&
      co &&
      (co.includes(industry) ||
        (signal.geography &&
          co.includes(signal.geography.toLowerCase().slice(0, 5))))
    ) {
      paths.push({
        contact_id: n.id,
        contact_name: n.name,
        company_name: n.company,
        reason: `Possible network overlap via CRM company “${n.company}”.`,
        strength: "possible",
      });
    }
  }

  // Dedup by contact_id, prefer strong
  const byId = new Map<string, WarmIntroPath>();
  for (const p of paths) {
    const prev = byId.get(p.contact_id);
    if (!prev || (prev.strength === "possible" && p.strength === "strong")) {
      byId.set(p.contact_id, p);
    }
  }
  return Array.from(byId.values()).slice(0, 8);
}
