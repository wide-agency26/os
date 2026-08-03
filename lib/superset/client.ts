/**
 * lib/superset/client.ts
 * 
 * Centralized server-side client for Apache Superset REST API.
 * Handles JWT authentication (with caching), dashboard cloning,
 * guest token generation (with RLS), and dashboard listing.
 * 
 * All functions are server-only — never import from client components.
 */

// ---------------------------------------------------------------------------
// Token Cache
// ---------------------------------------------------------------------------
let cachedToken: string | null = null;
let tokenExpiryTime = 0;

function getSupersetConfig() {
  const url = process.env.SUPERSET_URL;
  const username = process.env.SUPERSET_ADMIN_USER;
  const password = process.env.SUPERSET_ADMIN_PASSWORD;

  if (!url || !username || !password) {
    throw new Error(
      "Missing Superset environment variables. Set SUPERSET_URL, SUPERSET_ADMIN_USER, SUPERSET_ADMIN_PASSWORD."
    );
  }

  return { url: url.replace(/\/$/, ""), username, password };
}

/**
 * Authenticate with Superset and cache the JWT for 5 minutes.
 */
export async function getSupersetToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiryTime) {
    return cachedToken;
  }

  const { url, username, password } = getSupersetConfig();

  const res = await fetch(`${url}/api/v1/security/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, provider: "db" }),
  });

  if (!res.ok) {
    throw new Error(`Superset login failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiryTime = now + 5 * 60 * 1000; // 5 min cache
  return cachedToken as string;
}

// ---------------------------------------------------------------------------
// CSRF Token (required for POST/PUT/DELETE in Superset)
// ---------------------------------------------------------------------------

async function getCsrfToken(jwt: string): Promise<string> {
  const { url } = getSupersetConfig();
  const res = await fetch(`${url}/api/v1/security/csrf_token/`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    throw new Error(`CSRF fetch failed: ${res.status}`);
  }
  const data = await res.json();
  return data.result;
}

// ---------------------------------------------------------------------------
// Dashboard Operations
// ---------------------------------------------------------------------------

export interface SupersetDashboard {
  id: number;
  dashboard_title: string;
  slug: string | null;
  url: string;
  status: string;
  published: boolean;
}

/**
 * List all dashboards (used to show master templates to admins).
 */
export async function listDashboards(): Promise<SupersetDashboard[]> {
  const jwt = await getSupersetToken();
  const { url } = getSupersetConfig();

  const res = await fetch(
    `${url}/api/v1/dashboard/?q=(page:0,page_size:100)`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to list dashboards: ${res.status}`);
  }

  const data = await res.json();
  return (data.result || []).map((d: any) => ({
    id: d.id,
    dashboard_title: d.dashboard_title,
    slug: d.slug,
    url: d.url,
    status: d.status,
    published: d.published,
  }));
}

/**
 * Get a single dashboard's metadata (including its UUID for embedding).
 */
export async function getDashboardInfo(
  dashboardId: number
): Promise<{ id: number; uuid: string; title: string; slug: string | null }> {
  const jwt = await getSupersetToken();
  const { url } = getSupersetConfig();

  const res = await fetch(`${url}/api/v1/dashboard/${dashboardId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get dashboard ${dashboardId}: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.result.id,
    uuid: data.result.uuid,
    title: data.result.dashboard_title,
    slug: data.result.slug,
  };
}

/**
 * Clone (copy) a master dashboard template for a specific client.
 * Returns the new dashboard's ID, UUID, and slug.
 */
export async function cloneDashboard(
  sourceId: number,
  newTitle: string
): Promise<{ id: number; uuid: string; slug: string | null }> {
  const jwt = await getSupersetToken();
  const csrf = await getCsrfToken(jwt);
  const { url } = getSupersetConfig();

  const res = await fetch(`${url}/api/v1/dashboard/${sourceId}/copy/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      "X-CSRFToken": csrf,
      Referer: url, // Superset may require Referer for CSRF
    },
    body: JSON.stringify({
      dashboard_title: newTitle,
      // Superset copies all charts and datasets by default
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Failed to clone dashboard ${sourceId}: ${res.status} — ${errBody}`
    );
  }

  const data = await res.json();
  const newId = data.result?.id ?? data.id;

  // Fetch the newly created dashboard to get its UUID
  const info = await getDashboardInfo(newId);
  return info;
}

// ---------------------------------------------------------------------------
// Guest Token Generation (for Embedded SDK)
// ---------------------------------------------------------------------------

export interface RlsRule {
  clause: string; // e.g. "client_id = 'abc-123'"
  dataset?: number; // optional: restrict to specific dataset
}

/**
 * Generate a Superset Guest Token for the embedded SDK.
 * The token carries RLS rules that restrict the dashboard to a single client's data.
 */
export async function generateGuestToken(
  dashboardUuid: string,
  rlsRules: RlsRule[]
): Promise<string> {
  const jwt = await getSupersetToken();
  const csrf = await getCsrfToken(jwt);
  const { url } = getSupersetConfig();

  const payload = {
    user: {
      username: "guest",
      first_name: "Report",
      last_name: "Viewer",
    },
    resources: [
      {
        type: "dashboard",
        id: dashboardUuid,
      },
    ],
    rls: rlsRules.map((r) => ({
      clause: r.clause,
      ...(r.dataset ? { dataset: r.dataset } : {}),
    })),
  };

  const res = await fetch(`${url}/api/v1/security/guest_token/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      "X-CSRFToken": csrf,
      Referer: url,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `Failed to generate guest token: ${res.status} — ${errBody}`
    );
  }

  const data = await res.json();
  return data.token;
}
