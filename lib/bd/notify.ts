import { createAdminClient } from "@/utils/supabase/admin";
import type { Json } from "@/types/supabase";

export async function notifyBdStakeholders(input: {
  ownerId: string;
  observerIds: string[];
  title: string;
  message: string;
  link?: string | null;
  severity?: "Info" | "Success" | "Warning" | "Critical";
  meta?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const recipients = Array.from(
    new Set([input.ownerId, ...(input.observerIds || [])].filter(Boolean))
  );
  if (recipients.length === 0) return;

  const rows = recipients.map((user_id) => ({
    user_id,
    title: input.title,
    message: input.message,
    link: input.link ?? null,
    severity: input.severity ?? "Info",
    meta: (input.meta ?? {}) as Json,
  }));

  const { error } = await admin.from("staff_notifications").insert(rows);
  if (error) {
    console.error("staff_notifications insert failed", error);
  }

  // Also surface in founder notification center (workspace-wide inbox)
  await admin.from("founder_notifications").insert({
    title: input.title,
    message: input.message,
    severity_level: input.severity ?? "Info",
  });
}
