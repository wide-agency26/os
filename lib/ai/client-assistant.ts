import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-client founder assistant. Tools are bound to a single client_id so the
 * model can read the current record and write structured details into the
 * right tables (profile, brand hub, project) that power the client portal.
 */

export const CLIENT_ASSISTANT_MODEL = "anthropic/claude-sonnet-4.6";

export function clientAssistantSystemPrompt(clientLabel: string): string {
  return [
    "You are the WIDE OS client assistant — a precise operations helper for the agency's founders.",
    `You are working on a single client: ${clientLabel}.`,
    "Your job is to turn the founder's notes into structured records that populate this client's portal.",
    "",
    "Operating rules:",
    "- ALWAYS call getClientSnapshot first when a conversation starts or before editing, so you know what already exists.",
    "- Only write data the founder actually provided. Never invent names, colours, dates, or scope.",
    "- When you write something, call the matching tool (updateClientProfile, updateBrandHub, upsertProject). Do not just describe the change — perform it.",
    "- Brand colours must be hex codes. Dates must be ISO (YYYY-MM-DD).",
    "- After tool calls, briefly confirm in plain language what you saved and where it will appear.",
    "- Keep replies short and concrete. Ask one focused question if a required field is missing.",
  ].join("\n");
}

export function buildClientAssistantTools(
  supabase: SupabaseClient,
  clientId: string
) {
  return {
    getClientSnapshot: tool({
      description:
        "Read the client's current profile, brand hub (colours/typography/logo), and most recent project. Call this before making edits.",
      inputSchema: z.object({}),
      execute: async () => {
        const [profileRes, hubRes, projectRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, company_name, role")
            .eq("id", clientId)
            .maybeSingle(),
          supabase
            .from("brand_hubs")
            .select("brand_colors, typography, logo_url")
            .eq("client_id", clientId)
            .maybeSingle(),
          supabase
            .from("projects")
            .select("id, title, scope, status, start_date, end_date")
            .eq("client_id", clientId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        return {
          profile: profileRes.data ?? null,
          brandHub: hubRes.data ?? null,
          project: projectRes.data ?? null,
        };
      },
    }),

    updateClientProfile: tool({
      description: "Update the client's display name and/or company name on their profile.",
      inputSchema: z.object({
        full_name: z.string().min(1).optional(),
        company_name: z.string().min(1).optional(),
      }),
      execute: async ({ full_name, company_name }) => {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (full_name !== undefined) patch.full_name = full_name;
        if (company_name !== undefined) patch.company_name = company_name;
        const { error } = await supabase.from("profiles").update(patch).eq("id", clientId);
        if (error) return { ok: false, error: error.message };
        return { ok: true, updated: { full_name, company_name } };
      },
    }),

    updateBrandHub: tool({
      description:
        "Set the client's brand colours, typography, and logo URL. These render on the client's brand guideline page.",
      inputSchema: z.object({
        brand_colors: z
          .array(z.object({ name: z.string(), hex: z.string() }))
          .optional()
          .describe("Brand palette, each with a name and hex code like #00FF66"),
        typography: z
          .object({
            heading: z.string().optional(),
            body: z.string().optional(),
          })
          .optional(),
        logo_url: z.string().url().optional(),
      }),
      execute: async ({ brand_colors, typography, logo_url }) => {
        const payload: Record<string, unknown> = {
          client_id: clientId,
          updated_at: new Date().toISOString(),
        };
        if (brand_colors !== undefined) payload.brand_colors = brand_colors;
        if (typography !== undefined) payload.typography = typography;
        if (logo_url !== undefined) payload.logo_url = logo_url;
        const { error } = await supabase
          .from("brand_hubs")
          .upsert(payload, { onConflict: "client_id" });
        if (error) return { ok: false, error: error.message };
        return { ok: true, updated: { brand_colors, typography, logo_url } };
      },
    }),

    upsertProject: tool({
      description:
        "Create or update the client's main engagement/project (title, scope, status, dates).",
      inputSchema: z.object({
        title: z.string().min(1),
        scope: z.string().optional(),
        status: z.enum(["running", "completed", "expired"]).optional(),
        start_date: z.string().optional().describe("ISO date YYYY-MM-DD"),
        end_date: z.string().optional().describe("ISO date YYYY-MM-DD"),
      }),
      execute: async ({ title, scope, status, start_date, end_date }) => {
        const { data: existing } = await supabase
          .from("projects")
          .select("id")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const fields: Record<string, unknown> = {
          title,
          updated_at: new Date().toISOString(),
        };
        if (scope !== undefined) fields.scope = scope;
        if (status !== undefined) fields.status = status;
        if (start_date !== undefined) fields.start_date = start_date;
        if (end_date !== undefined) fields.end_date = end_date;

        if (existing?.id) {
          const { error } = await supabase.from("projects").update(fields).eq("id", existing.id);
          if (error) return { ok: false, error: error.message };
          return { ok: true, action: "updated", projectId: existing.id };
        }

        const { data, error } = await supabase
          .from("projects")
          .insert({ client_id: clientId, status: status ?? "running", ...fields })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, action: "created", projectId: data.id };
      },
    }),
  };
}
