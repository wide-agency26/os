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

async function testRls() {
  console.log("=== Querying RLS Policies for projects from pg_policies ===");
  const { data: policies, error: pErr } = await adminSupabase
    .from("pg_policies")
    .select("policyname, tablename, roles, cmd, qual, with_check")
    .eq("tablename", "projects");

  console.log("pg_policies error:", pErr?.message || "None");
  console.log("pg_policies for projects:", JSON.stringify(policies, null, 2));
}

testRls();
