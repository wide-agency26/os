"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { adminPaths } from "@/lib/wide-os/paths";

export type AdminServiceState = {
  error?: string;
  success?: string;
};

// --- SERVICES CRUD (process_services) ---

export async function createService(
  _prev: AdminServiceState,
  formData: FormData
): Promise<AdminServiceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "Strategy");
  const description = String(formData.get("description") ?? "").trim();
  const base_cost = parseFloat(String(formData.get("base_cost") ?? "0"));
  const base_value = parseFloat(String(formData.get("base_value") ?? "0"));
  const estimated_days = parseInt(String(formData.get("estimated_days") ?? "0"), 10);
  
  // Auto-generate a slug
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

  if (!name) return { error: "Service name is required." };

  const supabase = await createClient();
  const payload: any = {
    slug,
    name,
    category,
    description,
    base_cost: Number.isFinite(base_cost) ? base_cost : 0,
    base_value: Number.isFinite(base_value) ? base_value : 0,
    estimated_days: Number.isFinite(estimated_days) ? estimated_days : 0,
    sort_order: 99,
  };
  const { error } = await supabase.from("process_services").insert(payload);

  if (error) {
    if (error.code === "23505") return { error: "A service with a similar name already exists." };
    return { error: error.message };
  }

  revalidatePath(adminPaths.services());
  return { success: "Service created." };
}

export async function deleteService(id: string): Promise<AdminServiceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("process_services").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(adminPaths.services());
  return { success: "Service deleted." };
}

// --- PACKAGES CRUD (process_templates) ---

export async function createPackage(
  _prev: AdminServiceState,
  formData: FormData
): Promise<AdminServiceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const label = String(formData.get("label") ?? "").trim();
  const package_tier = String(formData.get("package_tier") ?? "Growth Program");
  const description = String(formData.get("description") ?? "").trim();
  const base_price = parseFloat(String(formData.get("base_price") ?? "0"));
  const estimated_days = parseInt(String(formData.get("estimated_days") ?? "0"), 10);
  
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");

  if (!label) return { error: "Package name is required." };

  const supabase = await createClient();
  const payload: any = {
    slug,
    label,
    package_tier,
    description,
    base_price: Number.isFinite(base_price) ? base_price : 0,
    estimated_days: Number.isFinite(estimated_days) ? estimated_days : 0,
    template_kind: "package",
    version: "v1.0",
    service_slugs: [],
  };
  const { error } = await supabase.from("process_templates").insert(payload);

  if (error) {
    if (error.code === "23505") return { error: "A package with a similar name already exists." };
    return { error: error.message };
  }

  revalidatePath(adminPaths.services());
  return { success: "Package created." };
}

export async function deletePackage(id: string): Promise<AdminServiceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("process_templates").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(adminPaths.services());
  return { success: "Package deleted." };
}
