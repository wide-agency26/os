import { createClient } from "@/utils/supabase/server";

export type AssignedManagerContact = {
  managerId: string;
  fullName: string | null;
  jobTitle: string | null;
  bio: string | null;
  publicEmail: string | null;
  phone: string | null;
  googleCalendarMeetingUrl: string | null;
  linkedinUrl: string | null;
};

export async function loadAssignedManagerContact(
  clientId: string
): Promise<AssignedManagerContact | null> {
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("client_profile_id", clientId)
    .limit(1)
    .maybeSingle();

  if (!workspace?.id) return null;

  const { data: assignment } = await supabase
    .from("workspace_assignments")
    .select("person_id")
    .eq("workspace_id", workspace.id)
    .limit(1)
    .maybeSingle();
    
  if (!assignment?.person_id) return null;

  const { data: person } = await supabase
    .from("people")
    .select("id, full_name, person_type")
    .eq("id", assignment.person_id)
    .maybeSingle();

  if (!person) return null;

  const meetingUrl = process.env.NEXT_PUBLIC_DEFAULT_GOOGLE_CALENDAR_URL?.trim() || null;

  return {
    managerId: person.id,
    fullName: person.full_name?.trim() ?? null,
    jobTitle: person.person_type?.trim() ?? "Manager",
    bio: null,
    publicEmail: null,
    phone: null,
    googleCalendarMeetingUrl: meetingUrl,
    linkedinUrl: null,
  };
}
