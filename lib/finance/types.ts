export type Recurrence = "one_time" | "recurring";

export type PlFilter = "actuals" | "identified" | "unidentified" | "combined";

export type MonthlyPlPoint = {
  month: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
};

export type FinanceDashboardData = {
  fyYear: number;
  years: number[];
  actuals: MonthlyPlPoint[];
  identified: MonthlyPlPoint[];
  unidentified: MonthlyPlPoint[];
  totals: {
    actualRevenue: number;
    actualCost: number;
    identifiedRevenue: number;
    identifiedCost: number;
    unidentifiedRevenue: number;
    unidentifiedCost: number;
    unidentifiedGap: number;
  };
};
