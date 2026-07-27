# Push WIDE OS schema to Supabase production

## Your project reference

Production project (WIDE OS V1):

```text
lzwmnxvirbocupqciqnp
```

URL: `https://lzwmnxvirbocupqciqnp.supabase.co`  
Dashboard: https://supabase.com/dashboard/project/lzwmnxvirbocupqciqnp

---

## 1. Install / use the CLI

```bash
# One-time (macOS)
brew install supabase/tap/supabase

# Or without brew (already works in this repo)
npx supabase --version
```

## 2. Log in (required once per machine)

```bash
npx supabase login
```

Opens the browser; approve access. Alternatively set a token:

```bash
export SUPABASE_ACCESS_TOKEN="your-token-from-dashboard-account-tokens"
```

## 3. Link this repo to production

From the project root:

```bash
cd /Users/alihashemi/Desktop/WIDE/wide-portal

npx supabase link --project-ref lzwmnxvirbocupqciqnp
```

You will be prompted for the **database password** (Supabase Dashboard → Project Settings → Database).

This writes `supabase/.temp/project-ref` and links migrations to remote.

## 4. Push migrations

```bash
npx supabase db push
```

This applies everything under `supabase/migrations/` in order (`20250101000001` → `20250101000013`).

**Dry run first (recommended):**

```bash
npx supabase db push --dry-run
```

## 5. Verify

```bash
# Local vs remote migration history
npx supabase migration list

# Optional: open DB shell
npx supabase db remote commit   # only if using older workflows — prefer migration list
```

In the Supabase SQL editor, confirm core tables exist:

- `profiles`, `projects`, `client_delivery_gates`
- `client_proposals`, `client_manager_profiles`
- `finance_identified_revenues`, `portal_activity`, `vault_files`

Check RLS: Table Editor → any table → **RLS enabled** with policies listed.

---

## Edge Functions

This repo does **not** ship Supabase Edge Functions. The Executive Copilot runs in the Next.js app (`lib/executive/copilot-insight.ts`), not as a deployed edge function.

To add edge functions later:

```bash
npx supabase functions new my-function
npx supabase functions deploy my-function
```

---

## If production already has partial schema

If you previously ran `FULL_SETUP.sql` or `FEATURES_EXTENSION.sql` manually:

1. Run `npx supabase db push --dry-run` and read conflicts.
2. For duplicate-object errors, mark migrations as applied:

   ```bash
   npx supabase migration repair --status applied <timestamp>
   ```

   Or baseline in Dashboard → Database → Migrations.

3. Re-run `npx supabase db push`.

---

## Vercel env vars (reminder)

Set in Vercel → Project → Settings → Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_SITE_URL` = your Vercel URL

Never commit `.env.local` to Git.

---

## 6. First superadmin + demo data

After at least one user signs up (magic link or OAuth at `/login`):

```bash
npm run bootstrap:production
```

This script (service role, server-only):

1. Sets the **first** `auth.users` row to `profiles.role = 'superadmin'`
2. Seeds demo prospect **Acme Growth Co.** (BD + `/prospect/[id]/proposal`)
3. If a `client` profile exists: kickoff gates + demo project

Re-run anytime after inviting more users; it skips duplicate demo rows.

**Manual alternative** (SQL Editor):

```sql
UPDATE public.profiles SET role = 'superadmin' WHERE id = '<your-auth-user-uuid>';
```

Or run `supabase/SEED_DEMO_PROSPECT.sql` after superadmin exists.
