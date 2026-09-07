import { createHmac, timingSafeEqual } from "crypto";

export const REPORT_SHARE_COOKIE = "wide_report_share";
export const REPORT_SHARE_TTL_SEC = 60 * 60 * 24 * 7;

type ShareTokenPayload = {
  kind: "report_share";
  slug: string;
  projectId: string;
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

export function signShareToken(slug: string, projectId: string, ttlSec = REPORT_SHARE_TTL_SEC) {
  const body: ShareTokenPayload = {
    kind: "report_share",
    slug,
    projectId,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const json = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(json).digest("base64url");
  return `${json}.${sig}`;
}

export function verifyShareToken(token: string | null | undefined): ShareTokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  const expected = createHmac("sha256", secret()).update(json).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8")
    ) as ShareTokenPayload;
    if (payload?.kind !== "report_share" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.slug || !payload.projectId) return null;
    return payload;
  } catch {
    return null;
  }
}
