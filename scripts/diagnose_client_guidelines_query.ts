import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const anonSupabase = createClient(supabaseUrl, anonKey);

async function diagnose() {
  console.log("=== STEP 1: Inspecting Data Linkages ===");

  // 1. Fetch all ci_guidelines
  const { data: guidelines, error: glErr } = await adminSupabase
    .from("ci_guidelines")
    .select("id, project_id, slug, status, theme, updated_at");
  console.log("ci_guidelines:", guidelines);
  console.log("ci_guidelines error:", glErr?.message || "None");

  // 2. Fetch all projects
  const { data: projects, error: prErr } = await adminSupabase
    .from("projects")
    .select("id, title, client_id");
  console.log("projects:", projects);
  console.log("projects error:", prErr?.message || "None");

  // 3. Fetch all crm_customers (companies)
  const { data: customers, error: custErr } = await adminSupabase
    .from("crm_customers")
    .select("id, company, name");
  console.log("crm_customers:", customers);

  // 4. Fetch all company_members
  const { data: members, error: memErr } = await adminSupabase
    .from("company_members")
    .select("id, user_id, company_id, status, source");
  console.log("company_members:", members);
  console.log("company_members error:", memErr?.message || "None");

  console.log("\n=== STEP 2: Replicating Client Query (Admin Client - Bypassing RLS) ===");

  const { data: rawData, error: rawErr } = await (adminSupabase as any)
    .from("ci_guidelines")
    .select(`
      id,
      slug,
      status,
      updated_at,
      projects!inner (
        id,
        title,
        client_id,
        crm_customers!client_id (
          id,
          company,
          name
        )
      )
    `)
    .eq("status", "published");

  console.log("Raw query error:", rawErr?.message || "None");
  console.log("Raw query returned count:", rawData?.length || 0);
  console.log("Raw query data:", JSON.stringify(rawData, null, 2));

  console.log("\n=== STEP 3: Testing PostgREST query with in() filter ===");
  if (members && members.length > 0) {
    const activeCompIds = members.filter((m: any) => m.status === 'active').map((m: any) => m.company_id);
    console.log("Active Company IDs in company_members:", activeCompIds);

    const { data: filteredData, error: filtErr } = await (adminSupabase as any)
      .from("ci_guidelines")
      .select(`
        id,
        slug,
        status,
        updated_at,
        projects!inner (
          id,
          title,
          client_id,
          crm_customers!client_id (
            id,
            company,
            name
          )
        )
      `)
      .eq("status", "published")
      .in("projects.client_id", activeCompIds.length > 0 ? activeCompIds : ["00000000-0000-0000-0000-000000000000"]);

    console.log("Filtered query error:", filtErr?.message || "None");
    console.log("Filtered query returned count:", filteredData?.length || 0);
    console.log("Filtered query data:", JSON.stringify(filteredData, null, 2));
  }
}

diagnose();
