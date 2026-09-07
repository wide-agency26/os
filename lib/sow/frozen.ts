/** Live client SOWs that must never be mutated. */
export const FROZEN_SOW_SLUGS = [
  "protocol-health-ai-2284167b",
  "protocol-health-ai-83cf9b86",
] as const;

export const FROZEN_SOW_WRITE_ERROR =
  "This published SOW is locked — it was already shared with the client. Duplicate it to make a new draft.";

export function isFrozenSowSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return (FROZEN_SOW_SLUGS as readonly string[]).includes(slug);
}

export async function assertSowWritable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  sowId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await supabase
    .from("sows")
    .select("public_slug")
    .eq("id", sowId)
    .maybeSingle();
  if (isFrozenSowSlug(data?.public_slug as string | null | undefined)) {
    return { ok: false, error: FROZEN_SOW_WRITE_ERROR };
  }
  return { ok: true };
}

