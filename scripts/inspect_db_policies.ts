import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
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

console.log("Supabase URL:", supabaseUrl ? "Found" : "Missing");
console.log("Service Key:", serviceRoleKey ? "Found" : "Missing");
console.log("Anon Key:", anonKey ? "Found" : "Missing");

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
const anonSupabase = createClient(supabaseUrl, anonKey);

async function inspect() {
  console.log("\n=== 1. Admin client query on projects (Service Role - Bypassing RLS) ===");
  const { data: adminProjects, error: adminProjErr } = await adminSupabase
    .from('projects')
    .select('id, title, status, client_id');
  console.log("Admin projects error:", adminProjErr?.message || "None");
  console.log("Admin projects count:", adminProjects?.length || 0);
  if (adminProjects && adminProjects.length > 0) {
    console.log("Projects sample:", adminProjects.slice(0, 5));
  }

  console.log("\n=== 2. Anon client query on projects (Unauthenticated - Testing RLS) ===");
  const { data: anonProjects, error: anonProjErr } = await anonSupabase
    .from('projects')
    .select('id, title, status');
  console.log("Anon projects error:", anonProjErr?.message || "None");
  console.log("Anon projects count:", anonProjects?.length || 0);

  console.log("\n=== 3. Profiles sample & roles ===");
  const { data: profiles, error: profErr } = await adminSupabase
    .from('profiles')
    .select('id, full_name, company_name, role')
    .limit(10);
  console.log("Profiles error:", profErr?.message || "None");
  console.log("Profiles count:", profiles?.length || 0);
  if (profiles && profiles.length > 0) {
    console.log("Profiles:", profiles);
  }

  console.log("\n=== 4. Guidelines sample ===");
  const { data: guidelines, error: glErr } = await adminSupabase
    .from('ci_guidelines')
    .select('id, project_id, slug, status');
  console.log("Guidelines error:", glErr?.message || "None");
  console.log("Guidelines count:", guidelines?.length || 0);
  if (guidelines && guidelines.length > 0) {
    console.log("Guidelines:", guidelines);
  }

  console.log("\n=== 5. Check company_members table ===");
  const { data: members, error: memErr } = await adminSupabase
    .from('company_members')
    .select('*');
  console.log("company_members error:", memErr?.message || "None");
  console.log("company_members count:", members?.length || 0);
}

inspect();
