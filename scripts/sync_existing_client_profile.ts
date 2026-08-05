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

async function syncProfiles() {
  console.log("=== Syncing Active company_members company_name to profiles ===");
  const { data: members } = await (adminSupabase as any)
    .from("company_members")
    .select("user_id, company_id, status")
    .eq("status", "active");

  if (members) {
    for (const m of members) {
      const { data: cData } = await (adminSupabase as any)
        .from("crm_customers")
        .select("company, name")
        .eq("id", m.company_id)
        .single();

      if (cData) {
        const cName = cData.company || cData.name || "Client Org";
        await adminSupabase
          .from("profiles")
          .update({ company_name: cName })
          .eq("id", m.user_id);
        console.log(`Updated user ${m.user_id} profile company_name to ${cName}`);
      }
    }
  }

  const { data: updatedProfiles } = await adminSupabase
    .from("profiles")
    .select("id, full_name, role, company_name");
  console.log("Updated profiles:", updatedProfiles);
}

syncProfiles();
