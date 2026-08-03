import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { SectionRenderer } from "@/components/ci-builder/sections";

export const revalidate = 60; // optionally cache for 60 seconds

async function getGuidelineData(slug: string) {
  // Using an anonymous supabase client with the anon key to query public data
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: guideline } = await (supabase as any)
    .from('ci_guidelines')
    .select('id, theme')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!guideline) return null;

  const { data: version } = await (supabase as any)
    .from('ci_guideline_versions')
    .select('content')
    .eq('guideline_id', guideline.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!version) return null;

  return version.content; // { theme, sections, assets }
}

export default async function PublicGuidelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getGuidelineData(slug);

  if (!data) {
    notFound();
  }

  const { theme, sections, assets } = data;

  const styleVariables = {
    '--ci-bg': theme?.backgroundColor || '#ffffff',
    '--ci-text': theme?.textColor || '#111111',
    '--ci-accent': theme?.accentColors?.[0] || '#000000',
    '--ci-border': '#eaeaea',
    '--ci-font': theme?.fontFamily || 'Inter, sans-serif',
  } as React.CSSProperties;

  return (
    <div 
      className="min-h-screen flex text-[var(--ci-text)] bg-[var(--ci-bg)] font-[var(--ci-font)]"
      style={styleVariables}
    >
      {/* Sidebar Nav */}
      <nav className="w-64 fixed top-0 left-0 h-screen border-r border-[var(--ci-border)] bg-[var(--ci-bg)] p-6 overflow-y-auto hidden md:block z-50">
        <div className="mb-12">
          {/* We'd typically have the primary logo here if one is marked as nav logo */}
          <h1 className="font-bold text-xl uppercase tracking-widest text-[var(--ci-accent)]">Brand<br/>Guideline</h1>
        </div>
        <ul className="space-y-4">
          {sections.map((sec: any) => (
            <li key={sec.id}>
              <a 
                href={`#${sec.section_type}`} 
                className="text-sm text-[var(--ci-text)] opacity-60 hover:opacity-100 hover:text-[var(--ci-accent)] transition-all font-medium uppercase tracking-wider"
              >
                {sec.eyebrow_label || sec.section_type}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 w-full relative">
        {sections.map((sec: any) => (
          <SectionRenderer 
            key={sec.id}
            section={sec}
            assets={assets.filter((a: any) => a.section_id === sec.id || a.kind === sec.section_type)}
            isAdmin={false}
          />
        ))}

        {/* Footer */}
        <footer className="py-12 border-t border-[var(--ci-border)] mt-24 text-center text-sm opacity-50">
          <p>Powered by WIDE Guidelines</p>
        </footer>
      </main>
    </div>
  );
}
