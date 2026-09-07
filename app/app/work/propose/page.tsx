import { redirect } from "next/navigation";
import { FoundersOnly } from "@/components/auth/FoundersOnly";
import { ProposeHub } from "@/components/strategy/ProposeHub";
import { loadLegacySlideDecks, loadProposeProjects } from "@/lib/strategy/load";
import { workPaths } from "@/lib/work/paths";
import { requireStaffPage } from "@/lib/auth/staff-session";

export default async function ProposePage({
  searchParams,
}: {
  searchParams: Promise<{ bd?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireStaffPage();
  if (!session.isStaff) return <FoundersOnly />;
  const { supabase } = session;

  if (sp.bd) {
    const { data: linked } = await supabase
      .from("projects")
      .select("id")
      .eq("bd_record_id", sp.bd)
      .limit(1)
      .maybeSingle();
    if (linked?.id) redirect(workPaths.proposeProject(linked.id));
  }

  const [projects, decks] = await Promise.all([
    loadProposeProjects(supabase),
    loadLegacySlideDecks(supabase),
  ]);

  return <ProposeHub projects={projects} decks={decks} />;
}
