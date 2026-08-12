import type { SowCategory, SowPortrayal, SowDocument, SowTheme, SowVat } from "./types";

export const DEFAULT_REVISION_ROUNDS = 2;

export const SOW_ASSETS_BUCKET = "sow-assets";

export const SOW_CATEGORY_ORDER: SowCategory[] = [
  "brand",
  "strategy",
  "growth",
  "content",
  "website",
  "custom",
];

export const CATEGORY_LABELS: Record<SowCategory, string> = {
  brand: "Brand",
  strategy: "Strategy",
  growth: "Growth",
  content: "Content",
  website: "Website",
  custom: "Custom",
};

export function portrayalForCategory(category: SowCategory): SowPortrayal {
  switch (category) {
    case "growth":
      return "channel_cards";
    case "content":
      return "quantity_cadence";
    case "website":
      return "phased";
    case "strategy":
    case "brand":
    case "custom":
    default:
      return "narrative";
  }
}

export const DEFAULT_TERMS_TEXT = `Scope of Work — Standard Terms

This Scope of Work defines the deliverables and engagement boundaries for the services listed herein. Work outside this scope requires a written change order.

Revisions: Up to {{revision_rounds}} rounds of revisions are included for design and creative deliverables that call out revision rounds. Additional rounds are billed separately.

Timeline: Dates are estimates contingent on timely client feedback and asset delivery. Delays in client responses may shift the schedule.

Ownership: Upon full payment, client owns final approved deliverables. Working files, unused concepts, and internal process materials remain WIDE property unless otherwise agreed.

Payment: Invoices are due as specified in the accompanying commercial terms. Work may pause if payments are overdue.

Conservative scope: Deliverables are defined tightly on purpose. If something is not listed in this SOW, it is not included.`;

export const DEFAULT_CONSERVATIVE_EYEBROW = "Conservative scope";

export const DEFAULT_CONSERVATIVE_BODY =
  "Up to {{revision_rounds}} rounds of revisions are included for design and creative review. Anything not listed below is out of scope.";

export const DEFAULT_SOW_THEME: SowTheme = {
  fontFamily: "Syne",
  background: "#0A0A0A",
  text: "#FFFFFF",
  mutedText: "rgba(255,255,255,0.62)",
  accent: "#FFFFFF",
  cardBg: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.12)",
};

export const DEFAULT_SOW_VAT: SowVat = {
  enabled: true,
  rate: 19,
  wording: "{{subtotal}} +{{rate}}% VAT = {{total}}",
};

export const SOW_FONT_OPTIONS: {
  id: SowTheme["fontFamily"];
  label: string;
  stack: string;
  google?: string;
}[] = [
  {
    id: "Syne",
    label: "Syne (WIDE default)",
    stack: '"Syne", ui-sans-serif, system-ui, sans-serif',
    google: "Syne:wght@400;500;600;700;800",
  },
  {
    id: "Space Grotesk",
    label: "Space Grotesk",
    stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    google: "Space+Grotesk:wght@400;500;600;700",
  },
  {
    id: "DM Sans",
    label: "DM Sans",
    stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    google: "DM+Sans:wght@400;500;600;700",
  },
  {
    id: "Instrument Sans",
    label: "Instrument Sans",
    stack: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
    google: "Instrument+Sans:wght@400;500;600;700",
  },
  {
    id: "Manrope",
    label: "Manrope",
    stack: '"Manrope", ui-sans-serif, system-ui, sans-serif',
    google: "Manrope:wght@400;500;600;700;800",
  },
];

export function resolveSowTheme(partial?: Partial<SowTheme> | null): SowTheme {
  return { ...DEFAULT_SOW_THEME, ...(partial || {}) };
}

export function resolveSowVat(partial?: Partial<SowVat> | null): SowVat {
  const rate = partial?.rate ?? DEFAULT_SOW_VAT.rate;
  return {
    enabled: partial?.enabled ?? DEFAULT_SOW_VAT.enabled,
    rate: Math.max(0, Math.min(100, Number.isFinite(rate) ? rate : DEFAULT_SOW_VAT.rate)),
    wording: partial?.wording?.trim() || DEFAULT_SOW_VAT.wording,
  };
}

export function formatSowMoney(
  amount: number,
  currency: string,
  fractionDigits = 0
): string {
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Net total: ungrouped line prices + merged cost group prices (no double-count). */
export function computeSowSubtotal(sow: SowDocument): number {
  let total = 0;
  for (const group of sow.cost_groups) {
    total += group.price ?? 0;
  }
  for (const section of sow.sections) {
    for (const item of section.line_items) {
      if (item.cost_group_id) continue;
      if (item.price != null) total += item.price;
    }
  }
  return total;
}

export function renderVatLine(
  wording: string,
  opts: {
    subtotal: number;
    rate: number;
    vatAmount: number;
    total: number;
    currency: string;
  }
): string {
  const { subtotal, rate, vatAmount, total, currency } = opts;
  return wording
    .replaceAll("{{subtotal}}", formatSowMoney(subtotal, currency, 0))
    .replaceAll("{{rate}}", String(rate))
    .replaceAll("{{vat}}", formatSowMoney(vatAmount, currency, 2))
    .replaceAll("{{total}}", formatSowMoney(total, currency, 2));
}

/** Compact VAT line for under a net price (drops leading subtotal from template). */
export function renderVatSubline(
  wording: string,
  opts: Parameters<typeof renderVatLine>[1]
): string {
  const compact =
    wording
      .replace(/^\s*\{\{subtotal\}\}\s*\+?\s*/i, "")
      .replace(/^\s*\+?\s*\{\{subtotal\}\}\s*/i, "")
      .trim() || "+{{rate}}% VAT = {{total}}";
  return renderVatLine(compact, opts);
}

export function sowVatAmounts(sow: SowDocument): {
  subtotal: number;
  vatAmount: number;
  total: number;
} | null {
  const vat = resolveSowVat(sow.vat);
  if (!vat.enabled) return null;
  const subtotal = computeSowSubtotal(sow);
  if (subtotal <= 0) return null;
  const vatAmount = subtotal * (vat.rate / 100);
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

export function sowFontStack(fontFamily: SowTheme["fontFamily"]): string {
  return (
    SOW_FONT_OPTIONS.find((f) => f.id === fontFamily)?.stack ||
    SOW_FONT_OPTIONS[0].stack
  );
}

export function sowGoogleFontHref(fontFamily: SowTheme["fontFamily"]): string | null {
  const opt = SOW_FONT_OPTIONS.find((f) => f.id === fontFamily);
  if (!opt?.google) return null;
  return `https://fonts.googleapis.com/css2?family=${opt.google}&display=swap`;
}

export function renderTermsText(terms: string, revisionRounds: number): string {
  return terms.replaceAll("{{revision_rounds}}", String(revisionRounds));
}

export function renderConservativeBody(
  body: string,
  revisionRounds: number
): string {
  return body.replaceAll("{{revision_rounds}}", String(revisionRounds));
}

export function revisionLabel(rounds: number): string {
  const n = Math.max(1, Math.round(rounds));
  const word = n === 1 ? "round" : "rounds";
  return `Up to ${n} ${word} of revisions included`;
}

export function formatSowDate(isoDate: string): string {
  try {
    const d = new Date(isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return isoDate;
  }
}

export function slugifySowPart(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export const SOW_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  accepted: "Accepted",
  archived: "Archived",
};
