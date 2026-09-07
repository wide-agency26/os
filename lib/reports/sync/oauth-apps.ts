import { createAdminClient } from "@/utils/supabase/admin";
import { credentialsKeyConfigured, decryptSecret, encryptSecret } from "@/lib/crypto/secrets";

export type MetaAppCreds = {
  appId: string;
  secret: string;
  source: "project" | "company" | "env";
  companyName: string | null;
};

export type MetaAppStatus = {
  configured: boolean;
  appId: string | null;
  companyName: string | null;
  companyId: string | null;
  scope: "project" | "company" | "env" | null;
  encryptionReady: boolean;
};

async function projectClient(projectId: string) {
  const admin = createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, client_id, company")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  let companyName = project.company ?? null;
  if (project.client_id) {
    const { data: company } = await admin
      .from("crm_customers")
      .select("name")
      .eq("id", project.client_id)
      .maybeSingle();
    if (company?.name) companyName = company.name;
  }
  return { ...project, companyName };
}

export async function getMetaAppStatus(projectId: string): Promise<MetaAppStatus> {
  const encryptionReady = credentialsKeyConfigured();
  const project = await projectClient(projectId);
  if (!project) {
    return {
      configured: false,
      appId: null,
      companyName: null,
      companyId: null,
      scope: null,
      encryptionReady,
    };
  }

  const admin = createAdminClient();
  const { data: projectApp } = await admin
    .from("project_oauth_apps")
    .select("app_id")
    .eq("provider", "meta")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectApp?.app_id) {
    return {
      configured: true,
      appId: projectApp.app_id,
      companyName: project.companyName,
      companyId: project.client_id,
      scope: "project",
      encryptionReady,
    };
  }

  if (project.client_id) {
    const { data: companyApp } = await admin
      .from("project_oauth_apps")
      .select("app_id")
      .eq("provider", "meta")
      .eq("company_id", project.client_id)
      .maybeSingle();
    if (companyApp?.app_id) {
      return {
        configured: true,
        appId: companyApp.app_id,
        companyName: project.companyName,
        companyId: project.client_id,
        scope: "company",
        encryptionReady,
      };
    }
  }

  if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
    return {
      configured: true,
      appId: process.env.META_APP_ID,
      companyName: project.companyName,
      companyId: project.client_id,
      scope: "env",
      encryptionReady,
    };
  }

  return {
    configured: false,
    appId: null,
    companyName: project.companyName,
    companyId: project.client_id,
    scope: null,
    encryptionReady,
  };
}

export async function resolveMetaAppForProject(projectId: string): Promise<MetaAppCreds | null> {
  const project = await projectClient(projectId);
  if (!project) return null;
  const admin = createAdminClient();

  const { data: projectApp } = await admin
    .from("project_oauth_apps")
    .select("app_id, secret_ciphertext")
    .eq("provider", "meta")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectApp?.app_id && projectApp.secret_ciphertext) {
    return {
      appId: projectApp.app_id,
      secret: decryptSecret(projectApp.secret_ciphertext),
      source: "project",
      companyName: project.companyName,
    };
  }

  if (project.client_id) {
    const { data: companyApp } = await admin
      .from("project_oauth_apps")
      .select("app_id, secret_ciphertext")
      .eq("provider", "meta")
      .eq("company_id", project.client_id)
      .maybeSingle();
    if (companyApp?.app_id && companyApp.secret_ciphertext) {
      return {
        appId: companyApp.app_id,
        secret: decryptSecret(companyApp.secret_ciphertext),
        source: "company",
        companyName: project.companyName,
      };
    }
  }

  if (process.env.META_APP_ID && process.env.META_APP_SECRET) {
    return {
      appId: process.env.META_APP_ID,
      secret: process.env.META_APP_SECRET,
      source: "env",
      companyName: project.companyName,
    };
  }

  return null;
}

export async function saveMetaAppForProject(input: {
  projectId: string;
  appId: string;
  secret?: string | null;
  userId?: string | null;
}): Promise<MetaAppStatus> {
  const appId = input.appId.trim();
  if (!/^\d{8,20}$/.test(appId)) {
    throw new Error("Meta App ID should be 8–20 digits.");
  }

  const project = await projectClient(input.projectId);
  if (!project) throw new Error("Project not found");

  const admin = createAdminClient();
  const companyId = project.client_id || null;

  const existingQuery = companyId
    ? admin
        .from("project_oauth_apps")
        .select("id, secret_ciphertext")
        .eq("provider", "meta")
        .eq("company_id", companyId)
        .maybeSingle()
    : admin
        .from("project_oauth_apps")
        .select("id, secret_ciphertext")
        .eq("provider", "meta")
        .eq("project_id", input.projectId)
        .maybeSingle();

  const { data: existing } = await existingQuery;
  const secret = input.secret?.trim() || "";
  if (!secret && !existing?.secret_ciphertext) {
    throw new Error("App secret is required the first time.");
  }
  if (secret && !credentialsKeyConfigured()) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set on the server.");
  }

  const secret_ciphertext = secret ? encryptSecret(secret) : existing!.secret_ciphertext;
  const now = new Date().toISOString();
  const row = {
    provider: "meta",
    company_id: companyId,
    project_id: companyId ? null : input.projectId,
    app_id: appId,
    secret_ciphertext,
    label: project.companyName,
    created_by: input.userId ?? null,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await admin.from("project_oauth_apps").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("project_oauth_apps").insert(row);
    if (error) throw new Error(error.message);
  }

  return getMetaAppStatus(input.projectId);
}
