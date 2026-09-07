import {
  asFinanceFrequency,
  dealTypeLabel,
  formatDealLabel,
  type FinanceFrequency,
} from "@/lib/accounting/finance";

export function DealAmountCell({
  amount,
  frequency,
  className = "",
  align = "right",
}: {
  amount: number | null | undefined;
  frequency?: FinanceFrequency | string | null;
  className?: string;
  align?: "left" | "right";
}) {
  const freq = asFinanceFrequency(frequency ?? undefined);
  const label = formatDealLabel(amount, freq);
  if (!label) {
    return (
      <span className={`text-text-secondary ${className}`}>—</span>
    );
  }
  return (
    <div
      className={`${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <span className="text-[12px] tabular-nums text-text-primary">{label}</span>
      <span className="block text-[10px] text-text-muted">{dealTypeLabel(freq)}</span>
    </div>
  );
}
