"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const fullName = formData.get("full_name") as string;
  const companyName = formData.get("company_name") as string;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      company_name: companyName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Revalidate both client and admin settings paths just in case
  revalidatePath("/settings");
  revalidatePath("/admin/settings");

  return { success: true };
}
