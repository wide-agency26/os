import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { loadSowDocument } from "@/lib/sow/load-sow";
import { SowDocumentView } from "@/components/sow/SowDocumentView";

export default async function ClientSowDetailPage({
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

  const { data: sow } = await loadSowDocument(id);
  if (!sow) notFound();

  const staff = profile && isFounder(profile.role);
  if (!staff && sow.status !== "published") notFound();

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A]">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
        <Link
          href="/app/client-sow"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft size={16} /> Scopes
        </Link>
        <Link
          href={`/app/client-sow/${sow.id}/print`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-white text-black px-3 py-1.5 hover:bg-gray-100"
        >
          <Printer size={14} /> Download PDF
        </Link>
      </div>
      <SowDocumentView sow={sow} mode="client" />
    </div>
  );
}
