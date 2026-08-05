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

const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

async function inspect() {
  console.log("=== 1. ALL crm_customers ===");
  const { data: crmData, error: crmErr } = await adminSupabase
    .from("crm_customers")
    .select("*");
  console.log("crm_customers error:", crmErr);
  console.log(crmData);

  console.log("\n=== 2. ALL profiles ===");
  const { data: profilesData } = await adminSupabase
    .from("profiles")
    .select("id, full_name, role, company_name");
  console.log(profilesData);

  console.log("\n=== 3. ALL company_members ===");
  const { data: membersData } = await adminSupabase
    .from("company_members")
    .select("id, user_id, company_id, status, source");
  console.log(membersData);

  console.log("\n=== 4. ALL projects ===");
  const { data: projectsData } = await adminSupabase
    .from("projects")
    .select("id, title, client_id");
  console.log(projectsData);
}

inspect();
