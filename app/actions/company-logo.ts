"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { isFounder } from "@/lib/rbac";
import {
  COMPANY_LOGO_SIZE,
  faviconUrlForHost,
  hostnameFromWebsite,
} from "@/lib/crm/logo";
import { revalidateWork } from "@/lib/work/revalidate";

const LOGO_BUCKET = "company-logos";

async function requireFounder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not authenticated" as string };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return { supabase, error: "Founders only" };
  }
  return { supabase, error: null as string | null };
}

function revalidateCompany(companyId: string) {
  revalidatePath("/app/work");
  revalidatePath("/app/home");
  revalidatePath(`/app/crm/${companyId}`);
  revalidateWork({ companyId });
}

export async function saveCompanyWebsite(
  companyId: string,
  website: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: upErr } = await (supabase as any)
    .from("crm_customers")
    .update({
      website: website.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .eq("record_kind", "company");
  if (upErr) return { ok: false, error: upErr.message };
  revalidateCompany(companyId);
  return { ok: true };
}

export async function fetchCompanyFavicon(
  companyId: string,
  website?: string
): Promise<{ ok: boolean; error?: string; logoUrl?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };

  let site = website?.trim() || "";
  if (!site) {
    const { data } = await (supabase as any)
      .from("crm_customers")
      .select("website")
      .eq("id", companyId)
      .maybeSingle();
    site = data?.website || "";
  }
  const host = hostnameFromWebsite(site);
  if (!host) {
    return { ok: false, error: "Add a website first (e.g. wide-communication.com)." };
  }
  const websiteUrl = site.includes("://") ? site : `https://${host}`;
  let logoUrl = faviconUrlForHost(host, COMPANY_LOGO_SIZE);
  try {
    const fetched = await fetch(logoUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/*" },
    });
    if (fetched.ok) {
      const buf = Buffer.from(await fetched.arrayBuffer());
      if (buf.length > 32) {
        const stored = await storeLogoPng(companyId, buf, fetched.headers.get("content-type") || "image/png");
        if (stored) logoUrl = stored;
      }
    }
  } catch {
    /* keep Google favicon URL as fallback */
  }
  const { error: upErr } = await (supabase as any)
    .from("crm_customers")
    .update({
      website: websiteUrl,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);
  if (upErr) return { ok: false, error: upErr.message };
  revalidateCompany(companyId);
  return { ok: true, logoUrl };
}

async function storeLogoPng(
  companyId: string,
  buf: Buffer,
  contentType: string
): Promise<string | null> {
  const admin = createAdminClient();
  const path = `${companyId}/${Date.now()}.png`;
  const { error } = await admin.storage.from(LOGO_BUCKET).upload(path, buf, {
    contentType: contentType.includes("jpeg") ? "image/jpeg" : "image/png",
    upsert: true,
  });
  if (error) return null;
  const { data } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

export async function uploadCompanyLogo(
  companyId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; logoUrl?: string }> {
  const { error } = await requireFounder();
  if (error) return { ok: false, error };
  if (!companyId) return { ok: false, error: "Missing company" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a PNG or JPG." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Keep the logo under 5 MB." };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const logoUrl = await storeLogoPng(companyId, buf, file.type || "image/png");
  if (!logoUrl) return { ok: false, error: "Could not store the logo. Try again." };
  const saved = await saveCompanyLogoUrl(companyId, logoUrl);
  if (!saved.ok) return saved;
  return { ok: true, logoUrl };
}

export async function saveCompanyLogoUrl(
  companyId: string,
  logoUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error } = await requireFounder();
  if (error) return { ok: false, error };
  const { error: upErr } = await (supabase as any)
    .from("crm_customers")
    .update({
      logo_url: logoUrl?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId)
    .eq("record_kind", "company");
  if (upErr) return { ok: false, error: upErr.message };
  revalidateCompany(companyId);
  return { ok: true };
}
