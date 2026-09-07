import type { FinanceFrequency } from "@/lib/accounting/finance";

/** Rough service labels for pipeline estimates (before a SOW exists). */
export const BD_ESTIMATE_SERVICES = [
  "[Package] MVB",
  "[Package] Startup Launch",
  "[Package] Growth Program",
  "[Package] Full-Service Partnership",
  "Website Development",
  "Website Design",
  "Visual Identity",
  "Brand Strategy",
  "Brand Guidelines",
  "SEO",
  "Paid Ads",
  "Social Media Content",
  "Video Production",
  "Graphic Design",
  "Marketing Strategy",
  "Campaign Planning",
  "Advance Analytics",
  "CRM & Advocacy",
] as const;

export type BdEstimate = {
  estimate_service: string | null;
  estimate_amount: number | null;
  estimate_frequency: FinanceFrequency;
  estimate_start_date: string | null;
  estimate_end_date: string | null;
};

export function projectOwnsBdEstimate(projectStage: string | null | undefined) {
  return (
    projectStage === "lead" ||
    projectStage === "client" ||
    projectStage === "signed" ||
    projectStage === "completed"
  );
}
