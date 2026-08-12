import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { runBdClientHandoff } from "@/lib/bd/handoff";
import { mergeQuotation } from "@/lib/bd/quotation";
import type { Json } from "@/types/supabase";

export const runtime = "nodejs";

/**
 * Lexware event subscription callback.
 * Configure with eventType quotation.status.changed → this URL.
 */
export async function POST(req: Request) {
  const secret = process.env.LEXWARE_WEBHOOK_SECRET;
  if (secret) {
    const header = req.headers.get("x-lexware-secret") || "";
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (header !== secret && bearer !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => null)) as {
    eventType?: string;
    resourceId?: string;
    resourceUri?: string;
  } | null;

  if (!body?.resourceId) {
    return NextResponse.json({ ok: false, error: "Missing resourceId" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("bd_records")
    .select("id, quotation")
    .filter("quotation->>lexware_quotation_id", "eq", body.resourceId)
    .limit(5);

  const record = rows?.[0];
  if (!record) {
    return NextResponse.json({ ok: true, matched: false });
  }

  // Prefer retrieving live status when key present; else trust event type
  let voucherStatus: string | null = null;
  if (process.env.LEXWARE_API_KEY) {
    const { getLexwareQuotation } = await import("@/lib/bd/lexware");
    const got = await getLexwareQuotation(body.resourceId);
    if (got.ok) voucherStatus = got.data.voucherStatus || null;
  }

  const q = mergeQuotation((record.quotation as Record<string, unknown>) || {});
  if (voucherStatus) q.voucher_status = voucherStatus;
  q.last_checked_at = new Date().toISOString();
  q.updated_at = new Date().toISOString();

  const accepted = voucherStatus === "accepted";

  if (accepted) {
    q.status = "accepted";
    q.accepted_at = q.accepted_at || new Date().toISOString();
    await admin
      .from("bd_records")
      .update({ quotation: q as unknown as Json })
      .eq("id", record.id);
    await runBdClientHandoff({ bdRecordId: record.id });
  } else if (voucherStatus === "rejected") {
    q.status = "rejected";
    await admin
      .from("bd_records")
      .update({ quotation: q as unknown as Json })
      .eq("id", record.id);
  } else {
    await admin
      .from("bd_records")
      .update({ quotation: q as unknown as Json })
      .eq("id", record.id);
  }

  return NextResponse.json({
    ok: true,
    matched: true,
    accepted: Boolean(accepted || voucherStatus === "accepted"),
  });
}
