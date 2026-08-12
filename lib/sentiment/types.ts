export type SentimentPolarity = "positive" | "neutral" | "negative" | "mixed";

export type SentimentFinding = {
  id: string;
  source:
    | "website"
    | "reviews_schema"
    | "press"
    | "social"
    | "google_business"
    | "manual";
  title: string;
  polarity: SentimentPolarity;
  detail: string;
  evidence?: string | null;
};

export type SentimentReportPayload = {
  brand_name: string;
  website_url: string | null;
  fetched_at: string;
  score: number;
  overall: SentimentPolarity;
  findings: SentimentFinding[];
  themes: { label: string; weight: number }[];
  limitations: string[];
};

export type SentimentReportRow = {
  id: string;
  public_slug: string;
  brand_name: string;
  website_url: string | null;
  status: "running" | "ready" | "failed";
  score: number | null;
  report: SentimentReportPayload;
  bd_record_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
