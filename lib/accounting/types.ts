/** Accounting ledger shared types. */

export type LedgerPillar = "actual" | "identified" | "unidentified";
export type LedgerType = "revenue" | "cost";
export type LedgerSource =
  | "manual"
  | "auto_project"
  | "auto_hr"
  | "auto_overhead"
  | "auto_lexware";
export type ProjectAccountingStage =
  | "prospect"
  | "lead"
  | "client"
  | "signed"
  | "completed";

export type CashBalanceSource = "manual" | "auto_lexware";

export type LedgerEntry = {
  id: string;
  pillar: LedgerPillar;
  type: LedgerType;
  amount: number;
  entry_date: string;
  company_id: string | null;
  client_id: string | null;
  project_id: string | null;
  person_id: string | null;
  category: string;
  source: LedgerSource;
  sync_key: string | null;
  moved_from_pillar: LedgerPillar | null;
  moved_at: string | null;
  confidence: string | null;
  created_at?: string;
  updated_at?: string;
  projects?: { id: string; title: string | null; stage?: string | null } | null;
  people?: { id: string; full_name: string | null } | null;
  company?: { id: string; name: string | null; company: string | null } | null;
};

export type CashBalanceEntry = {
  id: string;
  balance_date: string;
  amount: number;
  source: CashBalanceSource;
  notes: string | null;
};

export type LedgerActivity = {
  id: string;
  event_type: string;
  project_id: string | null;
  message: string;
  revenue_amount: number | null;
  cost_amount: number | null;
  created_at: string;
};

/** Primary funnel control shown on project pages. */
export const PROJECT_FUNNEL_STAGES: {
  value: "prospect" | "lead" | "client";
  label: string;
  pillar: LedgerPillar;
  hint: string;
}[] = [
  {
    value: "prospect",
    label: "Prospect",
    pillar: "unidentified",
    hint: "Unidentified P&L",
  },
  {
    value: "lead",
    label: "Lead",
    pillar: "identified",
    hint: "Identified P&L",
  },
  {
    value: "client",
    label: "Client",
    pillar: "actual",
    hint: "Actual P&L",
  },
];

export const PROJECT_STAGES: {
  value: ProjectAccountingStage;
  label: string;
  pillar: LedgerPillar;
}[] = [
  {
    value: "prospect",
    label: "Prospect → Unidentified",
    pillar: "unidentified",
  },
  {
    value: "lead",
    label: "Lead → Identified",
    pillar: "identified",
  },
  {
    value: "client",
    label: "Client → Actual",
    pillar: "actual",
  },
  {
    value: "completed",
    label: "Completed → Actual",
    pillar: "actual",
  },
];

/** Normalize legacy `signed` → `client` for UI. */
export function normalizeProjectStage(
  stage: string | null | undefined
): ProjectAccountingStage {
  if (stage === "signed") return "client";
  if (stage === "prospect" || stage === "lead" || stage === "client" || stage === "completed") {
    return stage;
  }
  return "prospect";
}

/** Map project accounting stage → ledger pillar. */
export function pillarFromStage(
  stage: string | null | undefined
): LedgerPillar {
  const s = normalizeProjectStage(stage);
  if (s === "prospect") return "unidentified";
  if (s === "lead") return "identified";
  return "actual"; // client | signed | completed
}

export function stagePillarLabel(stage: string | null | undefined): string {
  const pillar = pillarFromStage(stage);
  if (pillar === "unidentified") return "Unidentified";
  if (pillar === "identified") return "Identified";
  return "Actual";
}

export function formatEuro(amount: number | null | undefined): string {
  const n = Number(amount || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatEuroExact(amount: number | null | undefined): string {
  const n = Number(amount || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function isAutoSource(source: string | null | undefined): boolean {
  return (
    source === "auto_project" ||
    source === "auto_hr" ||
    source === "auto_overhead" ||
    source === "auto_lexware"
  );
}

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function currentFyYear(d = new Date()): number {
  return d.getFullYear();
}
