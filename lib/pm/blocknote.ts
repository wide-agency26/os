import type { PartialBlock } from "@blocknote/core";

/** Seed a minimal BlockNote doc from legacy plain-text description. */
export function blocksFromPlainText(
  text: string | null | undefined
): PartialBlock[] {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return [
      {
        type: "paragraph",
        content: [],
      },
    ];
  }

  const paragraphs = trimmed.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!paragraphs.length) {
    return [{ type: "paragraph", content: [] }];
  }

  return paragraphs.map(
    (para) =>
      ({
        type: "paragraph",
        content: para.replace(/\n/g, " "),
      }) as PartialBlock
  );
}

export function isBlockNoteDocument(value: unknown): value is PartialBlock[] {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === "object");
}

/** Prefer stored blocks; otherwise seed from description on first open. */
export function initialBlocksForTask(task: {
  content_blocks?: unknown;
  description?: string | null;
}): PartialBlock[] {
  if (isBlockNoteDocument(task.content_blocks) && task.content_blocks.length > 0) {
    return task.content_blocks as PartialBlock[];
  }
  return blocksFromPlainText(task.description);
}

/** Lossy plain-text extract for description / search / email fallbacks. */
export function blocksToPlainSummary(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const lines: string[] = [];

  const walkInline = (content: unknown): string => {
    if (!Array.isArray(content)) return "";
    return content
      .map((node: any) => {
        if (!node || typeof node !== "object") return "";
        if (node.type === "text") return String(node.text ?? "");
        if (node.type === "hardBreak") return "\n";
        if (node.type === "link") return walkInline(node.content);
        return walkInline(node.content);
      })
      .join("");
  };

  for (const block of blocks as any[]) {
    if (!block || typeof block !== "object") continue;
    const text = walkInline(block.content);
    if (text.trim()) lines.push(text);
    if (Array.isArray(block.children) && block.children.length) {
      const nested = blocksToPlainSummary(block.children);
      if (nested) lines.push(nested);
    }
  }

  return lines.join("\n\n").trim().slice(0, 8000);
}
