"use client";

import { BlockRenderer } from "@/components/brand-book/blocks/BlockRenderer";

export default function BrandPortal({ book }: { book: any }) {
  const blocks = book.canvas_blocks || [];
  const visibleBlocks = blocks.filter((b: any) => b.is_visible);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-[#00FF00] selection:text-black font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 p-6 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold tracking-tight text-zinc-100">{book.project_title}</span>
          </div>
          <div className="rounded-full border border-[#00FF00]/30 bg-[#00FF00]/10 px-4 py-1 text-xs font-medium tracking-widest text-[#00FF00] uppercase">
            Official Guidelines
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-12 flex flex-col md:flex-row gap-16">
        
        {/* Sticky Sidebar Navigation */}
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="sticky top-32 flex flex-col gap-2">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Contents</p>
            {visibleBlocks.map((block: any, idx: number) => (
              <a 
                key={block.id || idx} 
                href={`#section-${block.type}`}
                className="text-sm font-medium text-zinc-400 hover:text-[#00FF00] transition-colors uppercase tracking-wide py-1"
              >
                {block.type.replace('_', ' ')}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main Content Areas */}
        <main className="flex-1 space-y-32 pb-32">
          {visibleBlocks.map((block: any, idx: number) => (
            <section key={block.id || idx} id={`section-${block.type}`} className="scroll-mt-32">
              <BlockRenderer block={block} />
            </section>
          ))}
          
          {visibleBlocks.length === 0 && (
            <div className="text-center text-zinc-500 py-32 border border-zinc-800 rounded-2xl bg-zinc-900/30">
              <p>No content has been published yet.</p>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
