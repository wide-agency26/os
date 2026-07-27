"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";
import { adminPaths } from "@/lib/wide-os/paths";

export type AdminResourceState = {
  error?: string;
  success?: string;
};

// --- PEOPLE CRUD ---

export async function addPerson(
  _prev: AdminResourceState,
  formData: FormData
): Promise<AdminResourceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const full_name = String(formData.get("full_name") ?? "").trim();
  const person_type = String(formData.get("person_type") ?? "Employee");
  const hourly_rate_cost = parseFloat(String(formData.get("hourly_rate_cost") ?? "0"));
  const capacity_score = parseInt(String(formData.get("capacity_score") ?? "100"), 10);

  if (!full_name) return { error: "Full name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("people").insert({
    full_name,
    person_type,
    hourly_rate_cost: Number.isFinite(hourly_rate_cost) ? hourly_rate_cost : 0,
    capacity_score: Number.isFinite(capacity_score) ? capacity_score : 100,
  });

  if (error) return { error: error.message };

  revalidatePath(adminPaths.resources());
  return { success: "Person added." };
}

export async function deletePerson(id: string): Promise<AdminResourceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(adminPaths.resources());
  return { success: "Person deleted." };
}

// --- TOOLS & OTHER RESOURCES CRUD ---

export async function addResource(
  _prev: AdminResourceState,
  formData: FormData
): Promise<AdminResourceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const resource_name = String(formData.get("resource_name") ?? "").trim();
  const resource_type = String(formData.get("resource_type") ?? "Tool");
  const billing_type = String(formData.get("billing_type") ?? "Fixed_Monthly");
  const cost_amount = parseFloat(String(formData.get("cost_amount") ?? "0"));
  const access_link = String(formData.get("access_link") ?? "").trim();

  if (!resource_name) return { error: "Resource name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    resource_name,
    resource_type,
    billing_type,
    cost_amount: Number.isFinite(cost_amount) ? cost_amount : 0,
    access_link: access_link || null,
  });

  if (error) return { error: error.message };

  revalidatePath(adminPaths.resources());
  return { success: "Resource added." };
}

export async function deleteResource(id: string): Promise<AdminResourceState> {
  const access = await resolveFounderLayoutAccess();
  if (!access.executive) return { error: "Executive access required." };

  const supabase = await createClient();
  const { error } = await supabase.from("resources").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(adminPaths.resources());
  return { success: "Resource deleted." };
}
