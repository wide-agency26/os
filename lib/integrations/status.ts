import { credentialsKeyConfigured } from "@/lib/crypto/secrets";
import {
  INTEGRATIONS,
  type IntegrationDef,
} from "@/lib/integrations/catalog";
import { createAdminClient } from "@/utils/supabase/admin";

export type HubStatus =
  | "connected"
  | "ready"
  | "needs_keys"
  | "planned"
  | "internal";

export type KeyPresence = {
  name: string;
  set: boolean;
  covered: boolean;
  required: boolean;
  note?: string;
};

export type IntegrationStatus = {
  id: string;
  status: HubStatus;
  keys: KeyPresence[];
  oauthCount: number;
  hint?: string;
};

function envSet(name: string): boolean {
  if (name === "CREDENTIALS_ENCRYPTION_KEY") return credentialsKeyConfigured();
  return Boolean(process.env[name]?.trim());
}

function requiredMissing(def: IntegrationDef): boolean {
  for (const k of def.keys) {
    if (!k.required) continue;
    if (k.anyOf?.length) {
      if (!k.anyOf.some((n) => envSet(n))) return true;
    } else if (!envSet(k.name)) {
      return true;
    }
  }
  return false;
}

function deriveStatus(def: IntegrationDef, oauthCount: number): HubStatus {
  if (def.maturity === "planned") return "planned";
  if (def.maturity === "internal") {
    return requiredMissing(def) ? "needs_keys" : "internal";
  }
  if (requiredMissing(def)) return "needs_keys";
  if (def.oauth && oauthCount === 0) return "ready";
  return "connected";
}

export async function loadIntegrationHub(): Promise<{
  items: IntegrationStatus[];
}> {
  const admin = createAdminClient() as any;
  const [adminInt, figma, dataConn, metaApps] = await Promise.all([
    admin.from("admin_integrations").select("provider"),
    admin.from("ci_figma_connections").select("id", { count: "exact", head: true }),
    admin
      .from("project_data_connections")
      .select("provider, status")
      .neq("status", "revoked"),
    admin.from("project_oauth_apps").select("id", { count: "exact", head: true }).eq("provider", "meta"),
  ]);

  const adminProviders = new Map<string, number>();
  for (const row of adminInt.data || []) {
    const p = String(row.provider || "");
    adminProviders.set(p, (adminProviders.get(p) || 0) + 1);
  }
  const dataByProvider = new Map<string, number>();
  for (const row of dataConn.data || []) {
    const p = String(row.provider || "");
    dataByProvider.set(p, (dataByProvider.get(p) || 0) + 1);
  }

  const workspace = adminProviders.get("google_workspace") || 0;
  const figmaCount = figma.count || 0;
  const metaBinds =
    (dataByProvider.get("meta_ads") || 0) + (dataByProvider.get("meta_instagram") || 0);
  const metaAppsCount = metaApps.count || 0;

  const items: IntegrationStatus[] = INTEGRATIONS.map((def) => {
    const keys: KeyPresence[] = def.keys.map((k) => {
      const set = envSet(k.name);
      const covered = k.anyOf?.length ? k.anyOf.some((n) => envSet(n)) : set;
      return {
        name: k.name,
        required: k.required,
        note: k.note,
        set,
        covered,
      };
    });

    let oauthCount = 0;
    if (def.oauth === "google_workspace") {
      oauthCount = workspace;
      if (def.id === "ga4") oauthCount = dataByProvider.get("google_analytics") || workspace;
      if (def.id === "gsc") oauthCount = dataByProvider.get("google_search_console") || workspace;
    } else if (def.oauth === "google_ads") oauthCount = dataByProvider.get("google_ads") || 0;
    else if (def.oauth === "youtube") oauthCount = dataByProvider.get("youtube") || 0;
    else if (def.oauth === "meta") oauthCount = metaBinds || metaAppsCount;
    else if (def.oauth === "figma") oauthCount = figmaCount;

    let hint: string | undefined;
    if (oauthCount > 0) {
      hint = `${oauthCount} connected`;
    }

    return {
      id: def.id,
      status: deriveStatus(def, oauthCount),
      keys,
      oauthCount,
      hint,
    };
  });

  return { items };
}
