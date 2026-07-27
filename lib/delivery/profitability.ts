export type TaskCostInput = {
  duration_hours: number;
  assignee_hourly_rate: number;
  resource_cost: number;
};

export function computeProjectProfitability(
  contractValue: number,
  tasks: TaskCostInput[]
): {
  contractValue: number;
  laborCost: number;
  resourceOverhead: number;
  profit: number;
  marginPct: number;
} {
  let laborCost = 0;
  let resourceOverhead = 0;
  for (const t of tasks) {
    laborCost += Number(t.duration_hours || 0) * Number(t.assignee_hourly_rate || 0);
    resourceOverhead += Number(t.resource_cost || 0);
  }
  const profit = contractValue - laborCost - resourceOverhead;
  const marginPct = contractValue > 0 ? Math.round((profit / contractValue) * 100) : 0;
  return {
    contractValue,
    laborCost: Math.round(laborCost * 100) / 100,
    resourceOverhead: Math.round(resourceOverhead * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    marginPct,
  };
}

export function resourceCostForBilling(
  billingType: string,
  costAmount: number,
  durationHours: number
): number {
  if (billingType === "Per_Project_Pass_Through") return costAmount;
  if (billingType === "Annual") return costAmount / 52;
  return costAmount; // Fixed_Monthly — treat as monthly pass-through per linked task
}
