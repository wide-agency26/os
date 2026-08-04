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
  console.log("=== Testing Single Project Query (Admin / Service Role) ===");
  const { data: p1, error: err1 } = await adminSupabase
    .from("projects")
    .select("*")
    .eq("id", "52f49dbf-06e6-4ba4-83a1-e1df3dee7e8c")
    .single();

  console.log("Admin single project:", p1);
  console.log("Admin single project error:", err1);

  console.log("\n=== Testing Single Project Query (Anon / Unauthenticated) ===");
  const { data: p2, error: err2 } = await anonSupabase
    .from("projects")
    .select("*")
    .eq("id", "52f49dbf-06e6-4ba4-83a1-e1df3dee7e8c")
    .single();

  console.log("Anon single project:", p2);
  console.log("Anon single project error:", err2);
}

diagnose();
