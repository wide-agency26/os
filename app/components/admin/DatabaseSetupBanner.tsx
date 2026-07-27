import { createClient } from "@/utils/supabase/server";
import { isMissingPublicTableError, friendlyDbSetupMessage } from "@/lib/supabase-health";

export async function DatabaseSetupBanner() {
  const supabase = await createClient();
  const { error: profilesErr } = await supabase.from("profiles").select("id").limit(1);

  if (!profilesErr) {
    const { error: financeErr } = await supabase.from("finance_actual_revenues").select("id").limit(1);
    if (!financeErr) return null;
    if (isMissingPublicTableError(financeErr.message, financeErr.code)) {
      return (
        <div className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">Finance tables not restored</p>
          <p className="mt-2 text-text-secondary leading-relaxed">
            <code className="text-text-primary">profiles</code> exists but{" "}
            <code className="text-text-primary">finance_actual_revenues</code> is missing. Run migration{" "}
            <code className="text-text-primary">20250101000017_restore_operational_ecosystem.sql</code> in the
            Supabase SQL Editor, then reload.
          </p>
        </div>
      );
    }
    return (
      <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
        <p className="font-medium text-text-primary">Database</p>
        <p className="mt-1 text-text-secondary">{friendlyDbSetupMessage(financeErr.message)}</p>
      </div>
    );
  }

  const error = profilesErr;

  if (!isMissingPublicTableError(error.message, error.code)) {
    return (
      <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
        <p className="font-medium text-text-primary">Database</p>
        <p className="mt-1 text-text-secondary">{friendlyDbSetupMessage(error.message)}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
      <p className="font-semibold text-danger">Supabase schema not ready</p>
      <p className="mt-2 text-text-secondary leading-relaxed">
        The Data API can&apos;t see <code className="text-text-primary">public.profiles</code>. Usually the
        table was never created in this project, or API privileges weren&apos;t granted.
      </p>
      <ol className="mt-3 list-decimal pl-5 text-text-secondary space-y-2 text-[13px]">
        <li>
          Open{" "}
          <strong className="text-text-primary">Supabase Dashboard → SQL Editor</strong> for this project.
        </li>
        <li>
          Run migrations in order through{" "}
          <code className="text-text-primary">20250101000017_restore_operational_ecosystem.sql</code>, then{" "}
          <code className="text-text-primary">supabase/SEED_WORKSPACES_FROM_PROFILES.sql</code> if you have
          client profiles.
        </li>
        <li>
          In <strong className="text-text-primary">Table Editor</strong>, confirm{" "}
          <code className="text-text-primary">workspaces</code>,{" "}
          <code className="text-text-primary">finance_actual_revenues</code>, and{" "}
          <code className="text-text-primary">brand_hubs</code> exist.
        </li>
        <li>
          Sign up / log in once, then run:{" "}
          <code className="text-text-primary break-all">
            UPDATE public.profiles SET role = &apos;admin&apos; WHERE id = &apos;YOUR_USER_UUID&apos;;
          </code>
        </li>
      </ol>
      <p className="mt-3 text-[11px] text-text-muted font-mono">Details: {error.message}</p>
    </div>
  );
}
