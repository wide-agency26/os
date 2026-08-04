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

async function testFixedQueries() {
  const projectId = "52f49dbf-06e6-4ba4-83a1-e1df3dee7e8c";
  console.log("=== Testing FIXED ProjectDetailDashboard queries ===");

  const { data: pUsers, error: puErr } = await (adminSupabase as any)
    .from("erp_project_users")
    .select(`id, project_role, user:user_id ( id, full_name )`)
    .eq("project_id", projectId);
  console.log("4. erp_project_users fixed error:", puErr?.message || "None");

  const { data: timesheets, error: tsErr } = await (adminSupabase as any)
    .from("erp_timesheets")
    .select(`id, log_date, hours, billing_rate, note`)
    .eq("project_id", projectId);
  console.log("6. erp_timesheets fixed error:", tsErr?.message || "None");

  const { data: expenses, error: expErr } = await (adminSupabase as any)
    .from("erp_expenses")
    .select(`id, expense_date, amount, status`)
    .eq("project_id", projectId);
  console.log("7. erp_expenses fixed error:", expErr?.message || "None");

  const { data: invoices, error: invErr } = await (adminSupabase as any)
    .from("erp_invoices")
    .select(`id, issue_date, grand_total, status`)
    .eq("project_id", projectId);
  console.log("8. erp_invoices fixed error:", invErr?.message || "None");
}

testFixedQueries();
