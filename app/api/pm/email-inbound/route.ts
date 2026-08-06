import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseInboundToProposals } from "@/lib/pm/email-parse";

export const runtime = "nodejs";

/**
 * Inbound email / notes webhook.
 * Auth: Authorization: Bearer $PM_INBOUND_WEBHOOK_SECRET
 *       or header x-pm-inbound-secret
 *
 * Body JSON (Resend-ish / generic):
 * {
 *   "to": "munich@pm.wide.agency",   // or "recipient"
 *   "from": "...",
 *   "subject": "...",
 *   "text": "...",                   // or "body" / "html"
 *   "messageId": "optional"
 * }
 *
 * Never creates pm_tasks — only task_review_queue rows.
 */
export async function POST(req: Request) {
  const secret = process.env.PM_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "PM_INBOUND_WEBHOOK_SECRET not configured" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-pm-inbound-secret") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer !== secret && headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = String(body.to || body.recipient || "")
    .toLowerCase()
    .trim();
  const text = String(body.text || body.body || body.html || "").trim();
  const subject = String(body.subject || "").trim();
  const from = String(body.from || "").trim();
  const messageId = body.messageId ? String(body.messageId) : null;

  if (!to || !text) {
    return NextResponse.json(
      { error: "to and text/body are required" },
      { status: 400 }
    );
  }

  // Extract bare email if "Name <addr@x>"
  const emailMatch = to.match(/[\w.+-]+@[\w.-]+/);
  const inbound = (emailMatch?.[0] || to).toLowerCase();

  const admin = createAdminClient();
  const { data: project } = await (admin as any)
    .from("projects")
    .select("id, title")
    .eq("pm_inbound_email", inbound)
    .maybeSingle();

  if (!project) {
    return NextResponse.json(
      { error: `No project mapped to ${inbound}` },
      { status: 404 }
    );
  }

  const { data: openTasks } = await (admin as any)
    .from("pm_tasks")
    .select("id, title")
    .eq("project_id", project.id)
    .in("status", ["todo", "in_progress", "blocked"]);

  const parsed = await parseInboundToProposals({
    subject,
    body: text,
    openTasks: openTasks || [],
  });

  if (!parsed.proposals.length) {
    return NextResponse.json({
      ok: true,
      projectId: project.id,
      created: 0,
      message: "No actionable tasks extracted",
    });
  }

  const batchId = crypto.randomUUID();
  const rows = parsed.proposals.map((p) => ({
    project_id: project.id,
    proposed_title: p.title,
    proposed_description: p.description,
    suggested_match_task_id: p.suggestedMatchTaskId,
    status: "pending",
    source_ref: JSON.stringify({
      type: "email",
      to: inbound,
      from,
      subject,
      messageId,
      batchId,
      highVolume: parsed.highVolume,
      parseMode: parsed.parseMode,
      bodyPreview: text.slice(0, 500),
    }),
  }));

  const { error } = await (admin as any).from("task_review_queue").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    projectId: project.id,
    created: rows.length,
    highVolume: parsed.highVolume,
    parseMode: parsed.parseMode,
  });
}
