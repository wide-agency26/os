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

async function inspectPolicies() {
  console.log("=== Querying active policies from pg_catalog via raw SQL or rpc if available ===");
  // We can query pg_policies using an rpc or standard query if accessible
  const { data, error } = await (adminSupabase as any).rpc('exec_sql', {
    sql_query: "SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename IN ('projects', 'ci_guidelines', 'ci_guideline_versions', 'ci_assets');"
  });

  if (error) {
    console.log("exec_sql RPC not available:", error.message);
  } else {
    console.log("Active Policies:", data);
  }
}

inspectPolicies();
