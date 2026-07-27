"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function authenticateBrandPortal(client_slug: string, passwordAttempt: string) {
  const supabase = (await createClient()) as any;

  const { data: book, error } = await supabase
    .from("brand_books")
    .select("portal_password")
    .eq("client_slug", client_slug)
    .single();

  if (error || !book) {
    return { error: "Brand book not found." };
  }

  // In production we should use hashing (e.g. bcrypt). The spec said "plain-text or hashed", we'll do plain-text matching for now as requested.
  if (book.portal_password === passwordAttempt) {
    const c = await cookies();
    c.set(`widebook_auth_${client_slug}`, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });
    return { success: true };
  }

  return { error: "Incorrect password." };
}

export async function checkBrandPortalAuth(client_slug: string) {
  const c = await cookies();
  return c.get(`widebook_auth_${client_slug}`)?.value === "true";
}
