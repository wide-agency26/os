/**
 * One-off production bootstrap: superadmin + optional demo seeds.
 * Usage: node scripts/bootstrap-production.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 50,
  });
  if (listErr) throw listErr;

  const users = listData?.users ?? [];
  console.log(`Auth users: ${users.length}`);
  for (const u of users) {
    console.log(`  - ${u.id}  ${u.email ?? "(no email)"}`);
  }

  if (users.length === 0) {
    console.log("\nNo auth users yet. Sign up at /login first, then re-run this script.");
    return;
  }

  const primary = users[0];
  const email = primary.email ?? "";
  const fullName =
    (primary.user_metadata?.full_name ||
      primary.user_metadata?.name ||
      email.split("@")[0] ||
      "Admin") + "";

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", primary.id)
    .maybeSingle();

  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: primary.id,
      email: email || existingProfile?.email || "admin@wide.local",
      full_name: fullName,
      role: "superadmin",
    },
    { onConflict: "id" }
  );
  if (profileErr) throw profileErr;

  console.log(`\n✓ Profile ${primary.id} set to superadmin (${email || "no email"})`);

  const { count: prospectCount } = await admin
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("company_name", "Acme Growth Co.");

  if ((prospectCount ?? 0) > 0) {
    console.log("\nDemo prospect already exists — skipping SEED_DEMO_PROSPECT.");
  } else {
    const { data: prospect, error: pErr } = await admin
      .from("prospects")
      .insert({
        company_name: "Acme Growth Co.",
        contact_name: "Jordan Lee",
        contact_email: "jordan@acmegrowth.example",
        status: "proposal",
        lead_admin_id: primary.id,
        notes: "Demo prospect seeded for WIDE OS BD + prospect portal testing.",
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    const { error: propErr } = await admin.from("prospect_proposals").insert({
      prospect_id: prospect.id,
      title: "Acme Growth Co. — Brand & Web Partnership",
      executive_summary:
        "WIDE will deliver a unified brand system and marketing site aligned to your growth targets for H2.",
      scope_sections: [
        {
          heading: "Brand foundation",
          body: "Positioning workshop, visual identity, and voice guidelines.",
        },
        {
          heading: "Web experience",
          body: "Design system, key templates, and launch-ready marketing site.",
        },
      ],
      timeline: [
        { label: "Discovery", dates: "Weeks 1–2" },
        { label: "Creative routes", dates: "Weeks 3–4" },
        { label: "Build & launch", dates: "Weeks 5–10" },
      ],
      investment: {
        label: "Program investment",
        amount: "$48,000",
        notes: "50% kickoff · 50% at launch",
      },
      sow_draft:
        "Draft SOW: two revision rounds per milestone; client provides copy by Week 3.",
      is_published: true,
      published_at: new Date().toISOString(),
    });
    if (propErr) throw propErr;

    console.log(`\n✓ Demo prospect: /prospect/${prospect.id}/proposal`);
  }

  const { data: clientProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client")
    .limit(1);

  const clientId = clientProfiles?.[0]?.id;
  if (clientId) {
    const { error: gateErr } = await admin.from("client_delivery_gates").upsert(
      {
        client_id: clientId,
        creative_routes: [
          {
            id: "route-a",
            name: "Bold clarity",
            logic: "Lead with proof",
            tone: "Confident",
            creative: "High contrast",
            execution: "Hero + case studies",
          },
          {
            id: "route-b",
            name: "Warm craft",
            logic: "Human-first",
            tone: "Approachable",
            creative: "Organic textures",
            execution: "Story-led homepage",
          },
        ],
      },
      { onConflict: "client_id" }
    );
    if (gateErr) console.warn("client_delivery_gates:", gateErr.message);
    else console.log(`✓ Kickoff gates for client ${clientId}`);

    const { count: projectCount } = await admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("title", "Brand identity refresh");

    if ((projectCount ?? 0) === 0) {
      const end = new Date();
      end.setDate(end.getDate() + 90);
      const { error: projErr } = await admin.from("projects").insert({
        client_id: clientId,
        title: "Brand identity refresh",
        scope:
          "Logo system, palette, typography, and living guidelines in the portal.",
        status: "running",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        deliverables: [
          { name: "Logo system (primary + alternates)", done: true },
          { name: "Color & type tokens", done: true },
          { name: "Brand guidelines (portal)", done: false },
          { name: "Social templates", done: false },
        ],
      });
      if (projErr) console.warn("projects insert:", projErr.message);
      else console.log(`✓ Demo project for client ${clientId}`);
    } else {
      console.log("Demo project already exists for client.");
    }
  } else {
    console.log("\nNo client profile yet — invite a client to seed project + kickoff gates.");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
