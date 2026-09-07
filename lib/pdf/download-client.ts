import type { PdfRequest } from "@/lib/pdf/types";

export type PdfDownloadResult =
  | { ok: true; printUrl?: string }
  | { ok: false; error: string; printUrl?: string };

function filenameFromDisposition(header: string | null): string {
  if (!header) return "download.pdf";
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) return decodeURIComponent(star[1]);
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  return plain?.[1]?.trim() || "download.pdf";
}

export async function downloadPdf(body: PdfRequest): Promise<PdfDownloadResult> {
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const printUrl = res.headers.get("X-Print-Url") || undefined;

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      printUrl?: string;
    };
    return {
      ok: false,
      error: data.error || "Could not create PDF",
      printUrl: data.printUrl || printUrl,
    };
  }

  const blob = await res.blob();
  if (blob.size < 80 || blob.type.includes("json")) {
    return { ok: false, error: "PDF response was empty", printUrl };
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromDisposition(res.headers.get("Content-Disposition"));
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true, printUrl };
}
