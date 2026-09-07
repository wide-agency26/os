export type DebugTrailEvent = {
  at: string;
  kind: "route" | "tab" | "click";
  label: string;
  href?: string;
};

export type DebugConsoleLine = {
  at: string;
  level: "error" | "warn";
  message: string;
};

export type DebugNetworkFail = {
  at: string;
  method: string;
  url: string;
  status: number | null;
};

export type DebugSnapshot = {
  capturedAt: string;
  href: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  pageTitle: string;
  heading: string;
  selectedTab: string | null;
  locationLabel: string;
  trail: DebugTrailEvent[];
  console: DebugConsoleLine[];
  networkFails: DebugNetworkFail[];
  headings: string[];
  viewport: { w: number; h: number; dpr: number };
  userAgent: string;
  language: string;
  timezone: string;
  online: boolean;
  referrer: string;
  digest?: string | null;
};

export type DebugSeverity = "blocker" | "high" | "medium" | "low";
export type DebugStatus = "open" | "in_progress" | "resolved" | "hidden";
export type DebugReportType = "bug" | "enhancement";

export type DebugAttachment = {
  path: string;
  name: string;
  mime: string;
  size: number;
};

export type DebugReportInput = {
  title: string;
  whatHappened: string;
  expected: string;
  actual: string;
  beforeExperience: string;
  afterExperience: string;
  reproSteps: string;
  severity: DebugSeverity;
  reportType?: DebugReportType;
  projectId?: string | null;
  snapshot?: DebugSnapshot | null;
  attachments?: DebugAttachment[];
};
