import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query"); // The project name or client email to search for

    // 1. Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: "", ...options }); },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch integration tokens
    // We are using anon key here, which is fine since RLS policy allows admins to view
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const { data: integration } = await supabase
      .from("admin_integrations")
      .select("access_token, refresh_token")
      .eq("profile_id", profile.id)
      .eq("provider", "google_workspace")
      .single();

    if (!integration) {
      return NextResponse.json({ error: "Google Workspace not connected" }, { status: 404 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    });

    // Handle token refresh automatically by googleapis
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await supabaseAdmin.from("admin_integrations").update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString()
        }).eq("profile_id", profile.id).eq("provider", "google_workspace");
      } else {
        const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await supabaseAdmin.from("admin_integrations").update({
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
          updated_at: new Date().toISOString()
        }).eq("profile_id", profile.id).eq("provider", "google_workspace");
      }
    });

    // 3. Fetch Contextual Data in Parallel
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const tasks = google.tasks({ version: "v1", auth: oauth2Client });
    // Note: Chat/Spaces API requires Google Workspace org and slightly different setup, 
    // omitting for now to focus on the core context (Mail, Calendar, Tasks).

    const results = await Promise.allSettled([
      // Fetch Recent Emails
      gmail.users.messages.list({
        userId: 'me',
        q: query ? `${query}` : '', // basic search
        maxResults: 5,
      }).then(async res => {
        if (!res.data.messages) return [];
        // Fetch details for each message
        const messages = await Promise.all(res.data.messages.map(m => 
          gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] })
        ));
        return messages.map(m => {
          const headers = m.data.payload?.headers;
          return {
            id: m.data.id,
            snippet: m.data.snippet,
            subject: headers?.find(h => h.name === 'Subject')?.value,
            from: headers?.find(h => h.name === 'From')?.value,
            date: headers?.find(h => h.name === 'Date')?.value,
          };
        });
      }),

      // Fetch Upcoming Calendar Events
      calendar.events.list({
        calendarId: 'primary',
        q: query || undefined,
        timeMin: new Date().toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
      }).then(res => res.data.items?.map(i => ({
        id: i.id,
        summary: i.summary,
        start: i.start?.dateTime || i.start?.date,
        end: i.end?.dateTime || i.end?.date,
        link: i.htmlLink
      })) || []),

      // Fetch Tasks (Usually requires tasklist ID, using @default)
      tasks.tasks.list({
        tasklist: '@default',
        maxResults: 10,
        showCompleted: false,
      }).then(res => {
        // Simple filter in memory since tasks API doesn't support 'q' easily
        const allTasks = res.data.items || [];
        return query 
          ? allTasks.filter(t => t.title?.toLowerCase().includes(query.toLowerCase())) 
          : allTasks;
      }).then(filtered => filtered.slice(0, 5).map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        due: t.due,
      })))
    ]);

    const context = {
      emails: results[0].status === 'fulfilled' ? results[0].value : [],
      events: results[1].status === 'fulfilled' ? results[1].value : [],
      tasks: results[2].status === 'fulfilled' ? results[2].value : [],
    };

    return NextResponse.json(context);
  } catch (error: any) {
    console.error("Error fetching Google context:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
