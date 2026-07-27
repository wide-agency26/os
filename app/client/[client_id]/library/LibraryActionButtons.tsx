"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function LibraryActionButtons({ clientId }: { clientId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showDrivePrompt, setShowDrivePrompt] = useState(false);

  const supabase = createClient();

  const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${clientId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-vault')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('vault_files').insert({
        client_id: clientId,
        label: file.name,
        file_name: file.name,
        storage_path: filePath,
        mime_type: file.type,
        size_bytes: file.size,
        category: "General",
        folder_key: "general"
      });

      if (insertError) throw insertError;
      
      router.refresh();
    } catch (err: any) {
      alert("Error uploading file: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDriveSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const label = formData.get("label") as string;
    const url = formData.get("url") as string;

    if (!label || !url) return;

    try {
      setUploading(true);
      const { error } = await supabase.from('vault_files').insert({
        client_id: clientId,
        label: label,
        file_name: label,
        external_url: url,
        external_provider: "Google Drive",
        category: "General",
        folder_key: "general"
      });

      if (error) throw error;

      setShowDrivePrompt(false);
      router.refresh();
    } catch (err: any) {
      alert("Error adding link: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleLocalUpload} 
          className="hidden" 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Local Upload"}
        </button>
        <button 
          onClick={() => setShowDrivePrompt(true)}
          disabled={uploading}
          className="rounded-lg bg-[#00FF00] px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-[#00cc00] disabled:opacity-50"
        >
          + Google Drive URL
        </button>
      </div>

      {showDrivePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h3 className="mb-4 text-lg font-bold text-zinc-50">Add Google Drive Link</h3>
            <form onSubmit={handleDriveSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Label / Document Name</label>
                <input 
                  name="label" 
                  required 
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:border-[#00FF00] focus:outline-none" 
                  placeholder="e.g. Q3 Roadmap"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Google Drive URL</label>
                <input 
                  name="url" 
                  type="url" 
                  required 
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-50 focus:border-[#00FF00] focus:outline-none" 
                  placeholder="https://docs.google.com/..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowDrivePrompt(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="rounded-lg bg-[#00FF00] px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-[#00cc00]"
                >
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
