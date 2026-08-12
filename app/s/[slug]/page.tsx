import Link from "next/link";
import { FileQuestion, Lock } from "lucide-react";
import { loadPublishedSowBySlug } from "@/lib/sow/load-published";
import { SowDocumentView } from "@/components/sow/SowDocumentView";
import { ProposalResponseActions } from "@/components/bd/ProposalResponseActions";
import { resolveSowTheme } from "@/lib/sow/constants";

export const revalidate = 60;

export default async function PublicSowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublishedSowBySlug(slug);

  if (result.state === "not_found") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <FileQuestion className="w-10 h-10 mx-auto text-white/40" />
          <h1 className="text-2xl font-semibold">SOW not found</h1>
          <p className="text-sm text-white/50">
            This share link is invalid or the document was removed.
          </p>
          <Link href="https://www.wide-communication.com" className="text-sm text-white underline">
            wide-communication.com
          </Link>
        </div>
      </div>
    );
  }

  if (result.state === "draft") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Lock className="w-10 h-10 mx-auto text-amber-400/80" />
          <h1 className="text-2xl font-semibold">Not published yet</h1>
          <p className="text-sm text-white/50">
            “{result.title}” is still a draft. Ask WIDE for an updated link after
            publish.
          </p>
        </div>
      </div>
    );
  }

  const bg = resolveSowTheme(result.sow.theme).background;

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      <div className="sticky top-0 z-30 border-b border-black/10 bg-white/80 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <ProposalResponseActions
            linkedId={result.sow.id}
            proposalType="sow"
          />
        </div>
      </div>
      <SowDocumentView sow={result.sow} mode="client" />
    </div>
  );
}
