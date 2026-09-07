export type ProposeActionResult = {
  ok: boolean;
  error?: string;
  scopeId?: string;
  strategyId?: string;
  id?: string;
};

/** Fetch-based mutations so Propose pages never POST a server action to their own URL. */
export async function postProposeAction(
  module: string,
  action: string,
  input: object
): Promise<ProposeActionResult> {
  try {
    const res = await fetch("/api/propose/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, action, ...input }),
    });
    const json = (await res.json().catch(() => null)) as ProposeActionResult | null;
    if (!json) {
      return {
        ok: false,
        error: `Request failed (${res.status}). Stay on this page and try again.`,
      };
    }
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Request failed",
    };
  }
}
