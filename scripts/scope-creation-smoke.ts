/**
 * End-to-end Propose scope creation — same HTTP path the buttons use.
 * Creates a throwaway staff session, hits production /api/propose/action,
 * then deletes the test scope / user.
 *
 * Usage: npx tsx scripts/scope-creation-smoke.ts
 */
import fs from "fs";
import path from "path";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const match = t.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const ORIGIN = process.env.SMOKE_ORIGIN || "https://os.wide-communication.com";
const PROJECT_ID = "2eb67cac-9150-4a48-9d5d-54d340da7e24"; // TARA MVB
const LIVE_DEAL_ID = "48e12588-3c44-49e0-a346-e5cff9155844";

type ActionJson = {
  ok?: boolean;
  error?: string;
  scopeId?: string;
  strategyId?: string;
};

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function cookieHeader(jar: { name: string; value: string }[]): string {
  return jar
    .filter((c) => c.value)
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function http(
  method: string,
  url: string,
  opts?: { cookie?: string; json?: unknown; follow?: boolean }
): Promise<{ status: number; location: string | null; body: string; json: ActionJson | null }> {
  const headers: Record<string, string> = { Accept: "application/json, text/html" };
  if (opts?.cookie) headers.Cookie = opts.cookie;
  if (opts?.json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: opts?.json !== undefined ? JSON.stringify(opts.json) : undefined,
    redirect: opts?.follow === false ? "manual" : "follow",
  });
  const body = await res.text();
  let json: ActionJson | null = null;
  try {
    json = JSON.parse(body) as ActionJson;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    location: res.headers.get("location"),
    body,
    json,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !anon || !key) throw new Error("Missing Supabase env");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const failures: string[] = [];
  const created: { userId?: string; scopeIds: string[]; strategyIds: string[] } = {
    scopeIds: [],
    strategyIds: [],
  };

  console.log("=== Scope creation E2E ===");
  console.log("origin:", ORIGIN);
  console.log("mutate project:", PROJECT_ID, "(TARA MVB)");

  // --- HTTP: unauthenticated routes must not 404 ---
  console.log("\nphase 0: unauthenticated routes (expect login redirect / 401, not 404)");
  const unauthAction = await http("POST", `${ORIGIN}/api/propose/action`, {
    json: { module: "strategy", action: "createScopeFromPackage", projectId: PROJECT_ID },
    follow: false,
  });
  console.log(
    `  POST /api/propose/action → ${unauthAction.status}` +
      (unauthAction.location ? ` loc=${unauthAction.location}` : "")
  );
  if (unauthAction.status === 404) {
    failures.push("POST /api/propose/action is 404 without auth");
  }

  const unauthPage = await http("GET", `${ORIGIN}/app/work/propose/${PROJECT_ID}`, {
    follow: false,
  });
  console.log(
    `  GET /app/work/propose/{tara} → ${unauthPage.status}` +
      (unauthPage.location ? ` loc=${unauthPage.location}` : "")
  );
  if (unauthPage.status === 404) failures.push("propose project page is 404 without auth");

  const unauthMarket = await http("GET", `${ORIGIN}/app/work/propose/${LIVE_DEAL_ID}/market`, {
    follow: false,
  });
  console.log(
    `  GET live-deal /market → ${unauthMarket.status}` +
      (unauthMarket.location ? ` loc=${unauthMarket.location}` : "")
  );
  if (unauthMarket.status === 404) failures.push("live deal /market is 404");

  const unauthAudience = await http(
    "GET",
    `${ORIGIN}/app/work/propose/${LIVE_DEAL_ID}/audience`,
    { follow: false }
  );
  console.log(
    `  GET live-deal /audience → ${unauthAudience.status}` +
      (unauthAudience.location ? ` loc=${unauthAudience.location}` : "")
  );
  if (unauthAudience.status === 404) failures.push("live deal /audience is 404");

  const { data: project, error: projectErr } = await admin
    .from("projects")
    .select("id, title")
    .eq("id", PROJECT_ID)
    .maybeSingle();
  if (projectErr || !project) throw new Error(projectErr?.message || "TARA project missing");

  const { data: packages, error: pkgErr } = await admin
    .from("pm_packages")
    .select("id, name")
    .order("sort_order")
    .limit(8);
  if (pkgErr || !packages?.length) throw new Error(pkgErr?.message || "No packages");

  const { data: pkgLinks } = await admin
    .from("pm_package_services")
    .select("package_id, service_id");
  const pkgWithServices =
    packages.find((p) => (pkgLinks ?? []).some((l) => l.package_id === p.id)) || packages[0];

  const { data: services, error: svcErr } = await admin
    .from("pm_services")
    .select("id, name")
    .order("sort_order")
    .limit(8);
  if (svcErr || !services?.length) throw new Error(svcErr?.message || "No services");

  const stamp = Date.now();
  const email = `scope-smoke-${stamp}@wide-os.test`;
  const password = `Smoke-${stamp}-Aa1!`;

  let cookie = "";

  try {
    console.log("\nphase 1: throwaway staff session");
    const createdUser = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Scope smoke" },
    });
    if (createdUser.error || !createdUser.data.user) {
      throw new Error(createdUser.error?.message || "Could not create smoke user");
    }
    created.userId = createdUser.data.user.id;
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: created.userId,
      full_name: "Scope smoke",
      role: "superadmin",
    });
    if (profileErr) throw new Error(`profile upsert: ${profileErr.message}`);

    const jar: { name: string; value: string }[] = [];
    const browser = createBrowserClient(url, anon, {
      cookies: {
        getAll: () => jar.filter((c) => c.value),
        setAll: (cookies) => {
          for (const c of cookies) {
            const i = jar.findIndex((x) => x.name === c.name);
            if (i >= 0) jar[i] = { name: c.name, value: c.value };
            else jar.push({ name: c.name, value: c.value });
          }
        },
      },
    });
    const signed = await browser.auth.signInWithPassword({ email, password });
    if (signed.error || !signed.data.session) {
      throw new Error(signed.error?.message || "sign-in failed");
    }
    cookie = cookieHeader(jar);
    assert(cookie.includes("auth-token"), "session cookie missing");
    console.log("  session cookie set");

    async function press(
      label: string,
      action: string,
      input: Record<string, unknown>
    ): Promise<ActionJson> {
      const res = await http("POST", `${ORIGIN}/api/propose/action`, {
        cookie,
        json: { module: "strategy", action, ...input },
        follow: false,
      });
      const json = res.json;
      const ok = res.status === 200 && json?.ok === true;
      const err = json?.error || (!json ? `HTTP ${res.status} ${res.body.slice(0, 180)}` : undefined);
      console.log(`  ${ok ? "ok" : "FAIL"} ${label}${err ? ` — ${err}` : ""}`);
      if (!ok) failures.push(`${label}: ${err || "not ok"}`);
      return json || { ok: false, error: err };
    }

    console.log("\nphase 2: render ScopeBuilder (Create from package / À la carte)");
    const page = await http("GET", `${ORIGIN}/app/work/propose/${PROJECT_ID}`, { cookie });
    console.log(`  GET propose project → ${page.status} (${page.body.length} bytes)`);
    if (page.status === 404) failures.push("authenticated propose page 404");
    if (page.status >= 300 && page.status < 400) {
      failures.push(`authenticated propose page redirected (${page.status})`);
    }
    if (!/Engagement scope|Create from package|Create à la carte/i.test(page.body)) {
      failures.push("ScopeBuilder copy missing on propose page");
      console.log("  page snippet:", page.body.replace(/\s+/g, " ").slice(0, 280));
    } else {
      console.log("  ScopeBuilder rendered");
    }

    console.log("\nphase 3: Create from package");
    const fromPkg = await press("Create from package", "createScopeFromPackage", {
      projectId: PROJECT_ID,
      packageId: pkgWithServices.id,
    });
    assert(fromPkg.scopeId || failures.length, "package scope missing id");
    if (fromPkg.scopeId) created.scopeIds.push(fromPkg.scopeId);
    const scopeId = fromPkg.scopeId;

    console.log("\nphase 4: Create à la carte");
    const aLa = await press("Create à la carte", "createScopeALaCarte", {
      projectId: PROJECT_ID,
      serviceIds: [services[0].id],
      customItems: [{ name: "__TEST__ custom line", description: "smoke" }],
    });
    if (aLa.scopeId) created.scopeIds.push(aLa.scopeId);

    if (scopeId) {
      console.log("\nphase 5: status / items / strategies (package scope)");
      for (const status of ["sent", "accepted", "active", "draft"] as const) {
        await press(`Status ${status}`, "updateScopeStatus", {
          scopeId,
          projectId: PROJECT_ID,
          status,
        });
      }

      const { data: items } = await admin
        .from("scope_items")
        .select("id")
        .eq("scope_id", scopeId)
        .order("sort_order");
      const ids = (items ?? []).map((i) => i.id);
      if (ids.length >= 2) {
        const swapped = [ids[1], ids[0], ...ids.slice(2)];
        await press("Up (reorder)", "reorderScopeItems", {
          projectId: PROJECT_ID,
          scopeId,
          orderedIds: swapped,
        });
      } else {
        console.log("  skip reorder (need 2+ items)");
      }

      const extraService = services.find((s) => !(pkgLinks ?? []).some(
        (l) => l.package_id === pkgWithServices.id && l.service_id === s.id
      )) || services[services.length - 1];
      await press("Add service", "addScopeItem", {
        projectId: PROJECT_ID,
        scopeId,
        serviceId: extraService.id,
      });

      const { data: afterAdd } = await admin
        .from("scope_items")
        .select("id, service_id")
        .eq("scope_id", scopeId)
        .eq("service_id", extraService.id)
        .maybeSingle();
      if (afterAdd?.id) {
        await press("Remove item", "removeScopeItem", {
          projectId: PROJECT_ID,
          scopeId,
          itemId: afterAdd.id,
        });
      } else {
        failures.push("Add service did not persist an item");
      }

      const scopePage = await http(
        "GET",
        `${ORIGIN}/app/work/propose/${PROJECT_ID}/scope/${scopeId}`,
        { cookie }
      );
      console.log(`  GET Open strategies → ${scopePage.status}`);
      if (scopePage.status === 404) failures.push("scope strategies page 404");
      if (!/Create and open builder|Strategies/i.test(scopePage.body)) {
        failures.push("StrategyList copy missing");
      }

      const createdStrategy = await press("Create and open builder", "createStrategy", {
        projectId: PROJECT_ID,
        scopeId,
        strategyType: "website",
      });
      if (createdStrategy.strategyId) created.strategyIds.push(createdStrategy.strategyId);
      const strategyId = createdStrategy.strategyId;

      if (strategyId) {
        const builderPage = await http(
          "GET",
          `${ORIGIN}/app/work/propose/${PROJECT_ID}/scope/${scopeId}/${strategyId}/builder`,
          { cookie }
        );
        console.log(`  GET builder → ${builderPage.status}`);
        if (builderPage.status === 404) failures.push("builder page 404");

        const { data: modules } = await admin
          .from("strategy_modules")
          .select("id, module_key, status")
          .eq("strategy_id", strategyId)
          .order("sort_order");
        const attached = new Set((modules ?? []).map((m) => m.module_key));
        const toAdd = ["sentiment-analysis", "market-analysis", "audience-analysis"].find(
          (k) => !attached.has(k)
        );
        if (toAdd) {
          await press(`Add module ${toAdd}`, "addStrategyModule", {
            projectId: PROJECT_ID,
            scopeId,
            strategyId,
            moduleKey: toAdd,
          });
        } else {
          console.log("  skip add module (all keys already attached)");
        }

        const removable = (modules ?? [])[0];
        if (removable) {
          await press("Remove module", "removeStrategyModule", {
            projectId: PROJECT_ID,
            scopeId,
            strategyId,
            moduleId: removable.id,
          });
          await press("Re-add removed module", "addStrategyModule", {
            projectId: PROJECT_ID,
            scopeId,
            strategyId,
            moduleKey: removable.module_key,
          });
        }

        const { data: afterMods } = await admin
          .from("strategy_modules")
          .select("id, module_key")
          .eq("strategy_id", strategyId);
        const statusTarget = afterMods?.[0];
        if (statusTarget) {
          await press("Set module in_progress", "setStrategyModuleStatus", {
            projectId: PROJECT_ID,
            scopeId,
            strategyId,
            moduleId: statusTarget.id,
            status: "in_progress",
          });
        }

        await press("Remove strategy", "deleteStrategy", {
          projectId: PROJECT_ID,
          scopeId,
          strategyId,
        });
        created.strategyIds = created.strategyIds.filter((id) => id !== strategyId);
      }

      await press("Delete package scope", "deleteScope", {
        projectId: PROJECT_ID,
        scopeId,
      });
      created.scopeIds = created.scopeIds.filter((id) => id !== scopeId);
    }

    if (aLa.scopeId) {
      await press("Delete à la carte scope", "deleteScope", {
        projectId: PROJECT_ID,
        scopeId: aLa.scopeId,
      });
      created.scopeIds = created.scopeIds.filter((id) => id !== aLa.scopeId);
    }

    console.log("\nphase 6: unknown action should 400, not crash");
    const unknown = await http("POST", `${ORIGIN}/api/propose/action`, {
      cookie,
      json: { module: "strategy", action: "notARealButton" },
      follow: false,
    });
    console.log(`  unknown action → ${unknown.status} ${unknown.json?.error || ""}`);
    if (unknown.status === 404) failures.push("unknown action 404");
    if (unknown.status !== 400) failures.push(`unknown action expected 400, got ${unknown.status}`);
  } finally {
    console.log("\ncleanup");
    for (const id of created.strategyIds) {
      await admin.from("strategies").delete().eq("id", id);
    }
    for (const id of created.scopeIds) {
      await admin.from("scopes").delete().eq("id", id);
    }
    if (created.userId) {
      const del = await admin.auth.admin.deleteUser(created.userId);
      if (del.error) console.log("  user delete:", del.error.message);
      else console.log("  deleted smoke user");
    }
  }

  if (failures.length) {
    console.log("\nFAILED:");
    for (const f of failures) console.log(" -", f);
    process.exit(1);
  }
  console.log("\nALL PASSED — every ScopeBuilder / strategy button path returned ok, no 404s.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
