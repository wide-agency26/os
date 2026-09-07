const MCP_PAYLOAD_GUARD_CHARS = 38_000;

export function mcpSerialize(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data);
}

/** MCP tool text content — compact JSON (no pretty-print). */
export function mcpJsonResult(data: unknown, opts?: { guard?: boolean }) {
  const text = mcpSerialize(data);
  if (opts?.guard && text.length > MCP_PAYLOAD_GUARD_CHARS) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: `Response too large (${text.length} chars). Use compact mode or fetch individual rows.`,
            truncated: true,
            size_chars: text.length,
            limit_chars: MCP_PAYLOAD_GUARD_CHARS,
          }),
        },
      ],
      isError: true as const,
    };
  }
  return {
    content: [{ type: "text" as const, text }],
  };
}
