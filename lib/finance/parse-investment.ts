/** Parse amounts from prospect_proposals.investment JSON (e.g. "€48,000"). */
export function parseInvestmentAmount(investment: unknown): number | null {
  if (!investment || typeof investment !== "object") return null;
  const amount = (investment as { amount?: string }).amount;
  if (!amount || typeof amount !== "string") return null;
  const normalized = amount.replace(/,/g, "").match(/[\d.]+/);
  if (!normalized) return null;
  const n = parseFloat(normalized[0]);
  return Number.isFinite(n) ? n : null;
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** @deprecated Use formatEuro */
export const formatUsd = formatEuro;
