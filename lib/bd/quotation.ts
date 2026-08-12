export type BdQuotationStatus =
  | "pending_lexware"
  | "coming_soon"
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "stale";

export type BdQuotationPayload = {
  status: BdQuotationStatus;
  lexware_contact_id: string | null;
  lexware_quotation_id: string | null;
  voucher_number: string | null;
  voucher_status: string | null;
  deeplink: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  no_engagement_days: number;
  last_checked_at: string | null;
  placeholder: boolean;
  message: string | null;
  handoff: {
    company_id: string | null;
    project_id: string | null;
    completed_at: string | null;
  } | null;
  updated_at: string | null;
};

export function emptyQuotation(): BdQuotationPayload {
  return {
    status: "pending_lexware",
    lexware_contact_id: null,
    lexware_quotation_id: null,
    voucher_number: null,
    voucher_status: null,
    deeplink: null,
    sent_at: null,
    accepted_at: null,
    no_engagement_days: 5,
    last_checked_at: null,
    placeholder: false,
    message: null,
    handoff: null,
    updated_at: null,
  };
}

export function mergeQuotation(
  raw: Record<string, unknown> | null | undefined
): BdQuotationPayload {
  const base = emptyQuotation();
  if (!raw) return base;
  const handoff =
    raw.handoff && typeof raw.handoff === "object"
      ? (raw.handoff as Record<string, unknown>)
      : null;
  return {
    ...base,
    ...raw,
    status:
      typeof raw.status === "string"
        ? (raw.status as BdQuotationStatus)
        : base.status,
    lexware_contact_id:
      typeof raw.lexware_contact_id === "string"
        ? raw.lexware_contact_id
        : null,
    lexware_quotation_id:
      typeof raw.lexware_quotation_id === "string"
        ? raw.lexware_quotation_id
        : null,
    voucher_number:
      typeof raw.voucher_number === "string" ? raw.voucher_number : null,
    voucher_status:
      typeof raw.voucher_status === "string" ? raw.voucher_status : null,
    deeplink: typeof raw.deeplink === "string" ? raw.deeplink : null,
    sent_at: typeof raw.sent_at === "string" ? raw.sent_at : null,
    accepted_at: typeof raw.accepted_at === "string" ? raw.accepted_at : null,
    no_engagement_days:
      typeof raw.no_engagement_days === "number"
        ? raw.no_engagement_days
        : 5,
    last_checked_at:
      typeof raw.last_checked_at === "string" ? raw.last_checked_at : null,
    placeholder: Boolean(raw.placeholder),
    message: typeof raw.message === "string" ? raw.message : null,
    handoff: handoff
      ? {
          company_id:
            typeof handoff.company_id === "string" ? handoff.company_id : null,
          project_id:
            typeof handoff.project_id === "string" ? handoff.project_id : null,
          completed_at:
            typeof handoff.completed_at === "string"
              ? handoff.completed_at
              : null,
        }
      : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}
