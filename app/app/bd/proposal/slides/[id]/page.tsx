import { notFound } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { SlideBuilder } from "@/components/bd/SlideBuilder";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";

export default async function SlideDeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) notFound();

  const { data: deck } = await supabase
    .from("bd_slide_decks")
    .select(
      "id, title, status, slides, public_slug, bd_record_id, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!deck) notFound();

  return (
    <Workspace wide>
      <SlideBuilder
        deckId={deck.id}
        initialTitle={deck.title}
        initialStatus={deck.status}
        initialSlides={deck.slides}
        publicSlug={deck.public_slug}
        bdRecordId={deck.bd_record_id}
      />
    </Workspace>
  );
}
