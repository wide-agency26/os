"use client";

import { useState, Suspense, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

import { useRouter, useSearchParams } from "next/navigation";
import { WideLogo } from "@/components/brand/WideLogo";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get("error");
    if (q) setError(decodeURIComponent(q));
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Authenticate the user
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Authentication failed. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Fetch the user's role from the profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        router.push("/login");
        return;
      }

      const { data: workspace } = await supabase
        .from("profiles")
        .select("primary_account_id")
        .eq("id", authData.user.id)
        .maybeSingle();

      const workspaceId =
        (workspace?.primary_account_id as string | null) || authData.user.id;

      router.push("/app/home");
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4">
      {/* Background grid effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative w-full max-w-md page-enter">
        {/* Logo */}
        <div className="text-center mb-10 flex flex-col items-center">
          <WideLogo variant="onDark" height={40} priority boxed className="mb-4" />
          <p className="text-sm text-text-secondary">
            Access your strategic oversight dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface rounded-2xl border border-border p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="px-4 py-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 bg-surface-raised border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-medium text-text-muted uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-[11px] text-text-muted hover:text-accent transition-colors"
                >
                  Forgot Access?
                </button>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-surface-raised border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black text-sm font-semibold tracking-wide uppercase rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                "Initialize Session"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-text-muted uppercase tracking-widest">
              Secure Entry
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Biometric placeholder */}
          <button
            type="button"
            disabled
            className="w-full py-3 bg-surface-raised border border-border text-sm text-text-muted rounded-lg flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="8" cy="8" r="2" fill="currentColor" />
            </svg>
            Biometric Entry
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-text-muted">
          <span>v2.4.0-stable</span>
          <span>Support</span>
          <span>Privacy</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-text-muted text-sm">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
