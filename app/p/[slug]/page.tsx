import Link from "next/link";
import { FileQuestion, Lock } from "lucide-react";
import { createAdminClient } from "@/utils/supabase/admin";
import { ProposalResponseActions } from "@/components/bd/ProposalResponseActions";
import { normalizeSlides } from "@/lib/bd/slides";

export const revalidate = 60;

export default async function PublicSlideDeckPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: deck } = await admin
    .from("bd_slide_decks")
    .select("id, title, status, slides, public_slug")
    .eq("public_slug", slug)
    .maybeSingle();

  if (!deck) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <FileQuestion className="w-10 h-10 mx-auto text-white/40" />
          <h1 className="text-2xl font-semibold">Proposal not found</h1>
          <Link href="https://www.wide-communication.com" className="text-sm underline">
            wide-communication.com
          </Link>
        </div>
      </div>
    );
  }

  if (deck.status === "draft") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Lock className="w-10 h-10 mx-auto text-amber-400/80" />
          <h1 className="text-2xl font-semibold">Not published yet</h1>
          <p className="text-sm text-white/50">“{deck.title}” is still a draft.</p>
        </div>
      </div>
    );
  }

  const slides = normalizeSlides(deck.slides);
  const decided =
    deck.status === "accepted" ||
    deck.status === "declined" ||
    deck.status === "on_hold";

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            WIDE Proposal
          </p>
          <h1 className="text-lg font-semibold">{deck.title}</h1>
          <ProposalResponseActions
            linkedId={deck.id}
            proposalType="slides"
            disabledReason={
              decided
                ? `This proposal is already marked ${deck.status}.`
                : null
            }
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {slides.map((slide, idx) => (
          <section
            key={slide.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-3"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
              Slide {idx + 1} · {slide.kind}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">{slide.title}</h2>
            {slide.body && (
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {slide.body}
              </p>
            )}
            {slide.bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-sm text-white/80">
                {slide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {slide.portfolio?.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.portfolio.image_url}
                alt={slide.portfolio.title || ""}
                className="w-full max-h-80 object-cover rounded-xl border border-white/10"
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
