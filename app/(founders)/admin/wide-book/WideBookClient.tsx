"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrandBook, updateCanvasBlocks, ingestFromFigma } from "@/app/actions/wide-book";

export default function WideBookClient({ initialBooks, workspaces }: { initialBooks: any[], workspaces: any[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [books, setBooks] = useState(initialBooks);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const res = await createBrandBook(formData);
    setIsSubmitting(false);
    if (res.error) {
      alert(res.error);
    } else {
      setDrawerOpen(false);
      window.location.reload();
    }
  }

  async function handleIngest(bookId: string) {
    setIngestingId(bookId);
    const res = await ingestFromFigma(bookId);
    setIngestingId(null);
    if (res.error) {
      alert(res.error);
    } else {
      alert("Figma ingestion mock complete.");
      window.location.reload();
    }
  }

  async function toggleBlockVisibility(bookId: string, currentBlocks: any[], blockIndex: number) {
    const updatedBlocks = [...currentBlocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      is_visible: !updatedBlocks[blockIndex].is_visible
    };
    
    setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, canvas_blocks: updatedBlocks } : b));
    await updateCanvasBlocks(bookId, updatedBlocks);
  }

  async function updateBlockPayload(bookId: string, currentBlocks: any[], blockIndex: number, newPayloadStr: string) {
    try {
      const parsedPayload = JSON.parse(newPayloadStr);
      const updatedBlocks = [...currentBlocks];
      updatedBlocks[blockIndex] = {
        ...updatedBlocks[blockIndex],
        payload: parsedPayload
      };
      setBooks((prev) => prev.map((b) => b.id === bookId ? { ...b, canvas_blocks: updatedBlocks } : b));
      await updateCanvasBlocks(bookId, updatedBlocks);
      alert("Block saved!");
    } catch (e) {
      alert("Invalid JSON format");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-zinc-200">Brand Projects</h2>
        <button
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg bg-[#00FF00] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-80"
        >
          Create New Book
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-left text-sm text-zinc-400">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-6 py-4 font-medium">Project Title</th>
              <th className="px-6 py-4 font-medium">Slug</th>
              <th className="px-6 py-4 font-medium">Portal Link</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {books.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                  No brand books created yet.
                </td>
              </tr>
            ) : (
              books.map((book) => (
                <tr key={book.id} className="transition-colors hover:bg-zinc-900/30">
                  <td className="px-6 py-4 font-medium text-zinc-200">{book.project_title}</td>
                  <td className="px-6 py-4">{book.client_slug}</td>
                  <td className="px-6 py-4">
                    <Link href={`/brand/${book.client_slug}`} target="_blank" className="text-[#00FF00] hover:underline">
                      /brand/{book.client_slug}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleIngest(book.id)}
                      disabled={ingestingId === book.id}
                      className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                    >
                      {ingestingId === book.id ? "Ingesting..." : "Ingest & Compile"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-6">
        {books.map((book) => (
          <div key={book.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="mb-4 text-base font-semibold text-zinc-200">Canvas Blocks: {book.project_title}</h3>
            {(!book.canvas_blocks || book.canvas_blocks.length === 0) ? (
              <p className="text-zinc-500 text-sm">No blocks generated. Run "Ingest & Compile".</p>
            ) : (
              <div className="space-y-4">
                {book.canvas_blocks.map((block: any, idx: number) => {
                  const isActive = block.is_visible;
                  return (
                    <div key={block.id || idx} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-medium text-zinc-300 uppercase">{block.type}</h4>
                          <p className="text-xs text-zinc-500">Block ID: {block.id}</p>
                        </div>
                        <button
                          onClick={() => toggleBlockVisibility(book.id, book.canvas_blocks, idx)}
                          className={`flex items-center space-x-3 rounded-lg border px-3 py-1.5 transition-all ${
                            isActive ? "border-[#00FF00] bg-[#00FF00]/10" : "border-zinc-800 bg-zinc-950"
                          }`}
                        >
                          <span className={`text-xs font-bold uppercase ${isActive ? "text-[#00FF00]" : "text-zinc-500"}`}>
                            {isActive ? "Visible" : "Hidden"}
                          </span>
                          <div
                            className={`flex h-4 w-7 items-center rounded-full transition-colors ${
                              isActive ? "bg-[#00FF00]" : "bg-zinc-800"
                            }`}
                          >
                            <div
                              className={`h-3 w-3 rounded-full bg-black transition-transform ${
                                isActive ? "translate-x-3" : "translate-x-0.5"
                              }`}
                            />
                          </div>
                        </button>
                      </div>
                      
                      {isActive && (
                        <div>
                          <textarea 
                            className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-400 focus:border-[#00FF00] outline-none"
                            defaultValue={JSON.stringify(block.payload, null, 2)}
                            onBlur={(e) => updateBlockPayload(book.id, book.canvas_blocks, idx, e.target.value)}
                          />
                          <p className="text-[10px] text-zinc-600 mt-1">Edit payload directly (JSON format). Blurring input saves automatically.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in slide-in-from-right bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-zinc-100">Create Brand Project</h2>
              <button onClick={() => setDrawerOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4 flex-1">
              <div>
                <label className="flex items-center text-sm font-medium text-zinc-400 mb-1 group relative">
                  Select Client Workspace
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 cursor-help">?</span>
                  <div className="absolute bottom-full mb-2 hidden w-48 rounded bg-zinc-800 p-2 text-xs text-zinc-200 shadow-lg group-hover:block z-10">
                    The WIDE OS workspace this project belongs to. Links the brand book to the client's official record.
                  </div>
                </label>
                <select required name="client_id" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00FF00]">
                  <option value="">-- Choose Client --</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-zinc-400 mb-1 group relative">
                  Project Title
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 cursor-help">?</span>
                  <div className="absolute bottom-full mb-2 hidden w-48 rounded bg-zinc-800 p-2 text-xs text-zinc-200 shadow-lg group-hover:block z-10">
                    The internal and client-facing title of this specific brand book project.
                  </div>
                </label>
                <input required name="project_title" placeholder="e.g. Acme Rebrand 2024" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00FF00]" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-zinc-400 mb-1 group relative">
                  Client Slug
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 cursor-help">?</span>
                  <div className="absolute bottom-full mb-2 hidden w-48 rounded bg-zinc-800 p-2 text-xs text-zinc-200 shadow-lg group-hover:block z-10">
                    The URL path identifier. Will generate the public portal at /brand/[slug]
                  </div>
                </label>
                <input required name="client_slug" placeholder="acme" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00FF00]" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-zinc-400 mb-1 group relative">
                  Figma File URL
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 cursor-help">?</span>
                  <div className="absolute bottom-full mb-2 hidden w-64 rounded bg-zinc-800 p-2 text-xs text-zinc-200 shadow-lg group-hover:block z-10">
                    The URL of the Figma file containing the brand components. Find this in Figma by clicking Share {">"} Copy Link.
                  </div>
                </label>
                <input name="figma_file_url" type="url" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00FF00]" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-zinc-400 mb-1 group relative">
                  Figma Access Token
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 cursor-help">?</span>
                  <div className="absolute bottom-full mb-2 hidden w-64 rounded bg-zinc-800 p-2 text-xs text-zinc-200 shadow-lg group-hover:block z-10">
                    Your personal Figma API token to read the file. Generate this in Figma: Account Settings {">"} Personal Access Tokens.
                  </div>
                </label>
                <input name="figma_access_token" type="password" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00FF00]" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-zinc-400 mb-1 group relative">
                  Portal Password
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 cursor-help">?</span>
                  <div className="absolute bottom-full mb-2 hidden w-48 rounded bg-zinc-800 p-2 text-xs text-zinc-200 shadow-lg group-hover:block z-10">
                    The master password required for anyone to access the published Client Portal.
                  </div>
                </label>
                <input required name="portal_password" type="password" className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00FF00]" />
              </div>

              <div className="pt-6">
                <button disabled={isSubmitting} type="submit" className="w-full rounded-lg bg-[#00FF00] py-3 font-semibold text-black hover:opacity-90 disabled:opacity-50">
                  {isSubmitting ? "Creating..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
