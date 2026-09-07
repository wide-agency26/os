import type { PartialBlock } from "@blocknote/core";
import { blocksToPlainSummary, isBlockNoteDocument } from "@/lib/pm/blocknote";

type InlineStyles = {
  bold?: true;
  italic?: true;
  code?: true;
};

type TextInlineNode = {
  type: "text";
  text: string;
  styles: InlineStyles;
};

type LinkInlineNode = {
  type: "link";
  href: string;
  content: TextInlineNode[];
};

export type InlineContentNode = TextInlineNode | LinkInlineNode;

function inlineText(text: string, styles: InlineStyles = {}): TextInlineNode {
  return {
    type: "text",
    text,
    styles: Object.keys(styles).length ? styles : {},
  };
}

function linkNode(label: string, href: string): LinkInlineNode {
  return {
    type: "link",
    href,
    content: [inlineText(label)],
  };
}

/** Parse inline **bold**, *italic*, `code`, and [text](url) within a line. */
export function parseInlineMarkdown(line: string): InlineContentNode[] {
  const out: InlineContentNode[] = [];
  let i = 0;

  const push = (text: string, styles: InlineStyles = {}) => {
    if (!text) return;
    out.push(inlineText(text, styles));
  };

  while (i < line.length) {
    const linkMatch = line.slice(i).match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (linkMatch) {
      out.push(linkNode(linkMatch[1], linkMatch[2]));
      i += linkMatch[0].length;
      continue;
    }

    if (line.startsWith("**", i)) {
      const end = line.indexOf("**", i + 2);
      if (end > i + 2) {
        push(line.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }
    if (line[i] === "*" && line[i + 1] !== "*") {
      const end = line.indexOf("*", i + 1);
      if (end > i + 1) {
        push(line.slice(i + 1, end), { italic: true });
        i = end + 1;
        continue;
      }
    }
    if (line[i] === "`") {
      const end = line.indexOf("`", i + 1);
      if (end > i + 1) {
        push(line.slice(i + 1, end), { code: true });
        i = end + 1;
        continue;
      }
    }
    const nextSpecial = (() => {
      const markers = ["**", "*", "`", "["];
      const idx = markers
        .map((m) => line.indexOf(m, i))
        .filter((n) => n >= 0);
      return idx.length ? Math.min(...idx) : -1;
    })();
    if (nextSpecial === -1) {
      push(line.slice(i));
      break;
    }
    push(line.slice(i, nextSpecial));
    i = nextSpecial;
  }

  return out.length ? out : [inlineText("")];
}

function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line.trim());
}

function tableBlock(headers: string[], rows: string[][]): PartialBlock {
  const rowCells = (cells: string[]) =>
    cells.map((cell) => {
      const inline = parseInlineMarkdown(cell);
      return inline.length ? inline : [inlineText("")];
    });

  return {
    type: "table",
    content: {
      type: "tableContent",
      columnWidths: headers.map(() => undefined),
      rows: [
        { cells: rowCells(headers) },
        ...rows.map((row) => ({ cells: rowCells(row) })),
      ],
    },
  } as unknown as PartialBlock;
}

/** Convert markdown into BlockNote partial blocks for pm_tasks.content_blocks. */
export function blocksFromMarkdown(markdown: string): PartialBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: PartialBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || "text";
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({
        type: "codeBlock",
        props: { language: lang },
        content: code.join("\n"),
      });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        props: { level: Math.min(heading[1].length, 3) as 1 | 2 | 3 },
        content: parseInlineMarkdown(heading[2].trim()),
      });
      i += 1;
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(tableBlock(headers, rows));
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^[-*+]\s+/, "");
        blocks.push({
          type: "bulletListItem",
          content: parseInlineMarkdown(item),
        });
        i += 1;
      }
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const item = lines[i].trim().replace(/^\d+\.\s+/, "");
        blocks.push({
          type: "numberedListItem",
          content: parseInlineMarkdown(item),
        });
        i += 1;
      }
      continue;
    }

    const para: string[] = [trimmed];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*+]\s|\d+\.\s|```)/.test(lines[i].trim())) {
      if (lines[i].trim().includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
        break;
      }
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({
      type: "paragraph",
      content: parseInlineMarkdown(para.join(" ")),
    });
  }

  return blocks.length
    ? blocks
    : [{ type: "paragraph", content: [] }];
}

function resolveBodyFields(input: {
  body_markdown?: string | null;
  body?: string | null;
  content_blocks?: unknown;
}):
  | { ok: true; content_blocks: PartialBlock[]; description: string | null }
  | { ok: false; error: string }
  | { ok: true; content_blocks: null; description: null } {
  if (input.content_blocks !== undefined && input.content_blocks !== null) {
    if (!isBlockNoteDocument(input.content_blocks)) {
      return { ok: false, error: "content_blocks must be a BlockNote block array." };
    }
    const blocks = input.content_blocks as PartialBlock[];
    return {
      ok: true,
      content_blocks: blocks,
      description: blocksToPlainSummary(blocks) || null,
    };
  }

  const md =
    (typeof input.body_markdown === "string" ? input.body_markdown : "") ||
    (typeof input.body === "string" ? input.body : "");
  const trimmed = md.trim();
  if (!trimmed) {
    return { ok: true, content_blocks: null, description: null };
  }

  const blocks = blocksFromMarkdown(trimmed);
  return {
    ok: true,
    content_blocks: blocks,
    description: blocksToPlainSummary(blocks) || trimmed.slice(0, 8000),
  };
}

export function resolveTaskBodyInput(input: {
  body_markdown?: string | null;
  body?: string | null;
  content_blocks?: unknown;
}) {
  return resolveBodyFields(input);
}

/** Client Tasks tab body — separate field, never auto-copied from internal body. */
export function resolveClientTaskBodyInput(input: {
  client_body_markdown?: string | null;
  client_content_blocks?: unknown;
}):
  | { ok: true; client_content_blocks: PartialBlock[] }
  | { ok: false; error: string }
  | { ok: true; client_content_blocks: null } {
  if (input.client_content_blocks !== undefined && input.client_content_blocks !== null) {
    if (!isBlockNoteDocument(input.client_content_blocks)) {
      return { ok: false, error: "client_content_blocks must be a BlockNote block array." };
    }
    return {
      ok: true,
      client_content_blocks: input.client_content_blocks as PartialBlock[],
    };
  }

  const md =
    typeof input.client_body_markdown === "string" ? input.client_body_markdown : "";
  const trimmed = md.trim();
  if (!trimmed) {
    return { ok: true, client_content_blocks: null };
  }

  return {
    ok: true,
    client_content_blocks: blocksFromMarkdown(trimmed),
  };
}
