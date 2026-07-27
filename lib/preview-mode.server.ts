import { cookies } from "next/headers";
import {
  PREVIEW_COOKIE_CLIENT,
  PREVIEW_COOKIE_PROSPECT,
  PREVIEW_COOKIE_ROLE,
  parsePreviewCookieValues,
  type PreviewContext,
} from "@/lib/preview-mode";

export async function readPreviewContext(): Promise<PreviewContext | null> {
  const jar = await cookies();
  return parsePreviewCookieValues(
    jar.get(PREVIEW_COOKIE_ROLE)?.value,
    jar.get(PREVIEW_COOKIE_CLIENT)?.value,
    jar.get(PREVIEW_COOKIE_PROSPECT)?.value
  );
}
