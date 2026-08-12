/**
 * Lexware Office Public API client (https://api.lexware.io).
 * Rate limit: 2 req/s — serialize with a simple queue + backoff.
 */

export const LEXWARE_API_BASE =
  process.env.LEXWARE_API_BASE_URL || "https://api.lexware.io";

export const LEXWARE_APP_BASE =
  process.env.LEXWARE_APP_BASE_URL || "https://app.lexware.de";

/** Default days before no-engagement alert (business-day approximation). */
export const LEXWARE_NO_ENGAGEMENT_DAYS = Number(
  process.env.LEXWARE_NO_ENGAGEMENT_DAYS || "5"
);

export function hasLexwareCredentials(): boolean {
  return Boolean(process.env.LEXWARE_API_KEY?.trim());
}

export type LexwareResult<T> =
  | { ok: true; data: T; placeholder?: false }
  | {
      ok: false;
      error: string;
      placeholder?: boolean;
      comingSoon?: boolean;
    };

let lastRequestAt = 0;
const MIN_GAP_MS = 550; // ~2 req/s with margin

async function throttle() {
  const now = Date.now();
  const wait = MIN_GAP_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function lexwareFetch(
  path: string,
  init: RequestInit = {},
  attempt = 0
): Promise<Response> {
  const key = process.env.LEXWARE_API_KEY?.trim();
  if (!key) {
    throw new Error("LEXWARE_API_KEY not configured");
  }
  await throttle();
  const res = await fetch(`${LEXWARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const backoff = 500 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, backoff));
    return lexwareFetch(path, init, attempt + 1);
  }
  return res;
}

export async function lexwarePing(): Promise<LexwareResult<{ ok: true }>> {
  if (!hasLexwareCredentials()) {
    return {
      ok: false,
      error: "Lexware API key not configured yet.",
      placeholder: true,
      comingSoon: true,
    };
  }
  try {
    const res = await lexwareFetch("/v1/ping");
    if (!res.ok) {
      return { ok: false, error: `Lexware ping failed (${res.status})` };
    }
    return { ok: true, data: { ok: true } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ping failed" };
  }
}

export type LexwareContact = {
  id: string;
  organizationId?: string;
  version?: number;
  roles?: { customer?: { number?: number } };
  company?: { name?: string };
  person?: { firstName?: string; lastName?: string };
  emailAddresses?: { business?: string[] };
};

export async function findLexwareContact(input: {
  email?: string | null;
  name?: string | null;
}): Promise<LexwareResult<LexwareContact | null>> {
  if (!hasLexwareCredentials()) {
    return {
      ok: false,
      error: "Coming soon — add LEXWARE_API_KEY to enable contact sync.",
      placeholder: true,
      comingSoon: true,
    };
  }
  try {
    if (input.email) {
      const res = await lexwareFetch(
        `/v1/contacts?email=${encodeURIComponent(input.email)}&customer=true`
      );
      if (res.ok) {
        const json = (await res.json()) as {
          content?: LexwareContact[];
        };
        const hit = json.content?.[0];
        if (hit) return { ok: true, data: hit };
      }
    }
    if (input.name && input.name.trim().length >= 3) {
      const res = await lexwareFetch(
        `/v1/contacts?name=${encodeURIComponent(input.name.trim())}&customer=true`
      );
      if (res.ok) {
        const json = (await res.json()) as {
          content?: LexwareContact[];
        };
        const hit = json.content?.[0];
        if (hit) return { ok: true, data: hit };
      }
    }
    return { ok: true, data: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Contact search failed",
    };
  }
}

export async function createLexwareContact(input: {
  companyName: string;
  contactName: string;
  email?: string | null;
  phone?: string | null;
}): Promise<LexwareResult<{ id: string }>> {
  if (!hasLexwareCredentials()) {
    return {
      ok: false,
      error: "Coming soon — add LEXWARE_API_KEY to create Lexware contacts.",
      placeholder: true,
      comingSoon: true,
    };
  }
  const parts = input.contactName.trim().split(/\s+/);
  const firstName = parts[0] || input.contactName;
  const lastName = parts.slice(1).join(" ") || firstName;
  const body = {
    version: 0,
    roles: { customer: {} },
    company: {
      name: input.companyName,
      contactPersons: [
        {
          firstName,
          lastName,
          emailAddress: input.email || undefined,
          phoneNumber: input.phone || undefined,
          primary: true,
        },
      ],
    },
    emailAddresses: input.email
      ? { business: [input.email] }
      : undefined,
    phoneNumbers: input.phone ? { business: [input.phone] } : undefined,
  };
  try {
    const res = await lexwareFetch("/v1/contacts", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Create contact failed (${res.status}): ${text}` };
    }
    const json = (await res.json()) as { id: string };
    return { ok: true, data: { id: json.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create contact failed",
    };
  }
}

export type LexwareQuotationLine = {
  type: "custom" | "service";
  name: string;
  description?: string;
  quantity: number;
  unitName: string;
  unitPrice: {
    currency: "EUR";
    netAmount: number;
    taxRatePercentage: number;
  };
  discountPercentage?: number;
};

export async function createLexwareQuotation(input: {
  contactId: string;
  companyName: string;
  lineItems: LexwareQuotationLine[];
  finalize?: boolean;
  introduction?: string;
}): Promise<LexwareResult<{ id: string; resourceUri?: string; voucherStatus?: string }>> {
  if (!hasLexwareCredentials()) {
    return {
      ok: false,
      error: "Coming soon — add LEXWARE_API_KEY to create quotations in Lexware.",
      placeholder: true,
      comingSoon: true,
    };
  }
  const now = new Date();
  const exp = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const body = {
    voucherDate: now.toISOString(),
    expirationDate: exp.toISOString(),
    address: {
      contactId: input.contactId,
      name: input.companyName,
      countryCode: "DE",
    },
    lineItems: input.lineItems,
    totalPrice: { currency: "EUR" },
    taxConditions: { taxType: "net" },
    introduction: input.introduction,
    remark: "Erstellt aus WIDE OS BD Module.",
  };
  const qs = input.finalize ? "?finalize=true" : "";
  try {
    const res = await lexwareFetch(`/v1/quotations${qs}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Create quotation failed (${res.status}): ${text}`,
      };
    }
    const json = (await res.json()) as {
      id: string;
      resourceUri?: string;
      voucherStatus?: string;
    };
    return { ok: true, data: json };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Create quotation failed",
    };
  }
}

export async function getLexwareQuotation(
  id: string
): Promise<
  LexwareResult<{
    id: string;
    voucherStatus?: string;
    voucherNumber?: string;
  }>
> {
  if (!hasLexwareCredentials()) {
    return {
      ok: false,
      error: "Coming soon — Lexware not connected.",
      placeholder: true,
      comingSoon: true,
    };
  }
  try {
    const res = await lexwareFetch(`/v1/quotations/${id}`);
    if (!res.ok) {
      return { ok: false, error: `Retrieve quotation failed (${res.status})` };
    }
    const json = (await res.json()) as {
      id: string;
      voucherStatus?: string;
      voucherNumber?: string;
    };
    return { ok: true, data: json };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Retrieve quotation failed",
    };
  }
}

export function lexwareQuotationDeeplink(quotationId: string): string {
  return `${LEXWARE_APP_BASE}/permalink/quotations/view/${quotationId}`;
}

export async function ensureEventSubscription(callbackUrl: string): Promise<
  LexwareResult<{ id?: string; skipped?: boolean }>
> {
  if (!hasLexwareCredentials()) {
    return {
      ok: false,
      error: "Coming soon — webhook subscription needs LEXWARE_API_KEY.",
      placeholder: true,
      comingSoon: true,
    };
  }
  try {
    const res = await lexwareFetch("/v1/event-subscriptions", {
      method: "POST",
      body: JSON.stringify({
        eventType: "quotation.status.changed",
        callbackUrl,
      }),
    });
    if (res.status === 409) {
      return { ok: true, data: { skipped: true } };
    }
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `Event subscription failed (${res.status}): ${text}`,
      };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, data: { id: json.id } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Event subscription failed",
    };
  }
}
