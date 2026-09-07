import { cookies } from "next/headers";
import {
  VIEW_AS_COMPANY_COOKIE,
  VIEW_AS_CONTACT_COOKIE,
  VIEW_AS_RETURN_COOKIE,
  safeViewAsReturnPath,
} from "@/lib/client/view-as";
import { isUuid } from "@/lib/routing";

function cookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function readViewAsCompanyId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(VIEW_AS_COMPANY_COOKIE)?.value;
  return value && isUuid(value) ? value : null;
}

export async function readViewAsContactId(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(VIEW_AS_CONTACT_COOKIE)?.value;
  return value && isUuid(value) ? value : null;
}

export async function writeViewAsCookies(
  companyId: string,
  contactId: string | null,
  returnPath?: string | null
) {
  const jar = await cookies();
  jar.set(VIEW_AS_COMPANY_COOKIE, companyId, cookieOptions());
  if (contactId) {
    jar.set(VIEW_AS_CONTACT_COOKIE, contactId, cookieOptions());
  } else {
    jar.set(VIEW_AS_CONTACT_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  }
  if (returnPath !== undefined) {
    const back = safeViewAsReturnPath(returnPath);
    if (back) {
      jar.set(VIEW_AS_RETURN_COOKIE, back, cookieOptions());
    } else {
      jar.set(VIEW_AS_RETURN_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    }
  }
}

export { cookieOptions as viewAsCookieOptions };
