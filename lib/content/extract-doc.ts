async function pdfToText(buffer: Buffer): Promise<string> {
  // pdf-parse pulls pdf.js. Import only on PDF uploads so other routes stay alive.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

/** Best-effort DOCX: pull <w:t> runs if the file happens to decompress poorly; otherwise empty. */
function docxHint(name: string) {
  return `[DOCX: ${name}. Export as PDF or TXT for automatic extraction, or paste key excerpts in a .txt.]`;
}

export function guessContextMime(filename: string, mimeType?: string | null): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (name.endsWith(".doc")) return "application/msword";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "text/plain";
}

export async function extractUploadBytes(input: {
  buffer: Buffer;
  filename: string;
  mimeType?: string | null;
}): Promise<{ text: string; kind: string }> {
  const name = input.filename.toLowerCase();
  const type = guessContextMime(input.filename, input.mimeType);

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    try {
      return { text: await pdfToText(input.buffer), kind: "pdf" };
    } catch {
      return {
        text: `[PDF uploaded: ${input.filename}. Text could not be extracted on the server — paste a TXT excerpt instead.]`,
        kind: "pdf",
      };
    }
  }

  if (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    return { text: input.buffer.toString("utf8").trim(), kind: "text" };
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return { text: docxHint(input.filename), kind: "docx" };
  }

  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return {
      text: `[Image uploaded: ${input.filename}. Describe the visual in a TXT if it should ground generation.]`,
      kind: "image",
    };
  }

  return { text: `[File uploaded: ${input.filename}]`, kind: "other" };
}

export async function extractUploadText(file: File): Promise<{ text: string; kind: string }> {
  return extractUploadBytes({
    buffer: Buffer.from(await file.arrayBuffer()),
    filename: file.name,
    mimeType: file.type,
  });
}
