"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { completePortalPasswordChange } from "@/app/actions/company-members";
import { WideLogo } from "@/components/brand/WideLogo";
import { homePathForRole } from "@/lib/routing";
import { isClient } from "@/lib/rbac";
import { clientPortalHomeHref } from "@/app/actions/client-access";

function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }
    setLoading(true);
    const res = await completePortalPasswordChange(password);
    if (!res.ok) {
      setError(res.error || "Could not update password.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };
    const dest = isClient(profile?.role)
      ? await clientPortalHomeHref()
      : homePathForRole(profile?.role);
    window.location.assign(dest);
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10 flex flex-col items-center">
          <WideLogo variant="onDark" height={40} priority boxed className="mb-4" />
          <p className="text-sm text-text-secondary">Set your password to continue</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <div className="px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{error}</p>
              </div>
            ) : null}
            <div>
              <label className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent text-white py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm />
    </Suspense>
  );
}
