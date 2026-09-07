import { createHmac, timingSafeEqual } from "crypto";

export type PrintKind = "ci" | "ci_draft" | "report";

export type PrintTokenPayload = {
  kind: PrintKind;
  slug?: string;
  projectId?: string;
  category?: string;
  uid?: string;
  exp: number;
};

function secret() {
  return (
    process.env.PDF_PRINT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "wide-pdf-dev-secret"
  );
}

export function signPrintToken(
  payload: Omit<PrintTokenPayload, "exp">,
  ttlSec = 180
): string {
  const body: PrintTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function verifyPrintToken(token: string | null | undefined): PrintTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = createHmac("sha256", secret()).update(json).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as PrintTokenPayload;
    if (!payload?.kind || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function printFilename(parts: (string | null | undefined)[], fallback: string) {
  const raw = parts.filter(Boolean).join("-") || fallback;
  return (
    raw
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || fallback
  );
}
