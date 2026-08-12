export type SeoCheckStatus = "pass" | "warn" | "fail" | "info";

export type SeoCheck = {
  id: string;
  category:
    | "technical"
    | "on_page"
    | "performance"
    | "mobile"
    | "meta_schema"
    | "backlinks"
    | "competitor";
  title: string;
  status: SeoCheckStatus;
  detail: string;
  evidence?: string | null;
};

export type SeoAuditReport = {
  url: string;
  fetched_at: string;
  http_status: number | null;
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  score: number;
  checks: SeoCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  competitor?: {
    url: string;
    title: string | null;
    score: number;
    note: string;
  } | null;
  limitations: string[];
};

export type SeoAuditRow = {
  id: string;
  public_slug: string;
  url: string;
  normalized_url: string;
  title: string | null;
  status: "running" | "ready" | "failed";
  score: number | null;
  report: SeoAuditReport;
  competitor_url: string | null;
  bd_record_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
