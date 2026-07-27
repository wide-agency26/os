"use client";

import { useState } from "react";
import { authenticateBrandPortal } from "@/app/actions/brand-auth";
import { useRouter } from "next/navigation";

export default function BrandLockScreen({ client_slug, client_name }: { client_slug: string; client_name: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await authenticateBrandPortal(client_slug, password);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-md">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex h-12 items-center justify-center rounded-lg border border-[#00FF00]/30 bg-[#00FF00]/10 px-4 text-[#00FF00] font-mono tracking-widest text-sm">
            [ WIDE Book ]
          </div>
          <h2 className="text-2xl font-semibold text-zinc-100">Unlock {client_name}</h2>
          <p className="mt-2 text-sm text-zinc-400">Enter your password to view the brand guidelines.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-zinc-200 outline-none transition-colors focus:border-[#00FF00]"
              required
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#00FF00] py-3 font-semibold text-black transition-all hover:bg-[#00cc00] disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
