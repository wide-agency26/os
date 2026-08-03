import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, name, company } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
    }

    // Initialize Supabase Admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'WideOS2026!Client', // Default password
      email_confirm: true,
      user_metadata: {
        full_name: name
      }
    });

    if (authError && !authError.message.includes('already exists')) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Determine user ID (either created or existing)
    let userId;
    if (authError && authError.message.includes('already exists')) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users.users.find(u => u.email === email);
      if (existingUser) {
        userId = existingUser.id;
      } else {
        return NextResponse.json({ error: 'User exists but could not be retrieved' }, { status: 500 });
      }
    } else {
      userId = authData.user?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to create or retrieve user ID' }, { status: 500 });
    }

    // 2. Ensure Profile exists and is set to 'client'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: name,
        company_name: company || null,
        role: 'client'
      }, { onConflict: 'id' });

    if (profileError) {
      return NextResponse.json({ error: 'Failed to sync profile: ' + profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
