"use server";

import { isAcceptedUploadName } from "@/lib/data-hub/upload-names";
import { parseUploadFile } from "@/lib/data-hub/parse-workbook";

export async function parseUploadAction(formData: FormData): Promise<
  | { ok: true; sheets: { name: string; rows: Record<string, string>[] }[] }
  | { ok: false; error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name) {
    return { ok: false, error: "No file" };
  }
  if (!isAcceptedUploadName(file.name)) {
    return { ok: false, error: "Please upload a CSV, TSV, XLS, XLSX, or HTML file." };
  }
  try {
    const sheets = await parseUploadFile(file);
    return { ok: true, sheets };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not parse file",
    };
  }
}
