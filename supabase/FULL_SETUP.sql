-- =============================================================================
-- WIDE Portal — Full database setup for Supabase (run once in SQL Editor)
-- =============================================================================
--
-- WHY YOU SEE: "Could not find the table 'public.profiles' in the schema cache"
-- -----------------------------------------------------------------------------
-- 1) The table was never created — this script creates it.
-- 2) PostgREST (Data API) can't see the table — we GRANT access on public.
-- 3) Rare: Dashboard → Settings → API — confirm "public" schema is exposed;
--    after running SQL, wait ~1 min or restart project if cache seems stale.
--
-- HOW TO RUN
-- -----------------------------------------------------------------------------
-- Supabase Dashboard → SQL Editor → New query → paste this file → Run.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS where needed.
--
-- AFTER RUN
-- -----------------------------------------------------------------------------
-- 1) Sign up your first user (Auth → Users or /login).
-- 2) Promote to admin:
--    UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
-- 3) Invite clients from Admin → Clients.
--
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions (Supabase usually has these; harmless if already on)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: role of current user (for RLS). SECURITY DEFINER so it can read profiles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Auto-create profile when a new auth user is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'company_name', '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, public.profiles.company_name),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  company_name TEXT,
  role        TEXT NOT NULL DEFAULT 'client'
              CHECK (role IN ('client', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  scope       TEXT,
  status      TEXT NOT NULL DEFAULT 'running'
              CHECK (status IN ('running', 'expired', 'completed')),
  start_date  DATE,
  end_date    DATE,
  milestones  JSONB DEFAULT NULL,
  deliverables JSONB DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);

CREATE TABLE IF NOT EXISTS public.brand_hubs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_colors  JSONB DEFAULT '[]'::jsonb,
  typography    JSONB DEFAULT '{}'::jsonb,
  logo_url      TEXT,
  guideline_document JSONB DEFAULT NULL,
  guideline_source_path TEXT DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_hubs_client_id ON public.brand_hubs(client_id);

-- Backfill columns if tables existed from older migrations
ALTER TABLE public.brand_hubs
  ADD COLUMN IF NOT EXISTS guideline_document JSONB DEFAULT NULL;
ALTER TABLE public.brand_hubs
  ADD COLUMN IF NOT EXISTS guideline_source_path TEXT DEFAULT NULL;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT NULL;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deliverables JSONB DEFAULT NULL;

-- ---------------------------------------------------------------------------
-- Triggers: profile timestamps + projects + brand_hubs + auth signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_brand_hubs_updated_at ON public.brand_hubs;
CREATE TRIGGER set_brand_hubs_updated_at
  BEFORE UPDATE ON public.brand_hubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_hubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;

CREATE POLICY "Clients can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
CREATE POLICY "Clients can view own projects"
  ON public.projects FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to projects" ON public.projects;
CREATE POLICY "Admins have full access to projects"
  ON public.projects FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Clients can view own brand hub" ON public.brand_hubs;
CREATE POLICY "Clients can view own brand hub"
  ON public.brand_hubs FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to brand hubs" ON public.brand_hubs;
CREATE POLICY "Admins have full access to brand hubs"
  ON public.brand_hubs FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Storage bucket (brand guideline uploads)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('brand-guidelines', 'brand-guidelines', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "brand_guidelines_public_read" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_delete" ON storage.objects;

CREATE POLICY "brand_guidelines_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-guidelines');

CREATE POLICY "brand_guidelines_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "brand_guidelines_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "brand_guidelines_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- API access: so PostgREST / supabase-js can reach tables (RLS still enforces rows)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- Backfill profiles for any auth users created before this trigger existed
INSERT INTO public.profiles (id, full_name, company_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'full_name', ''),
  NULLIF(TRIM(COALESCE(u.raw_user_meta_data ->> 'company_name', '')), ''),
  'client'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Done
SELECT 'WIDE portal schema ready. Run: UPDATE public.profiles SET role = ''admin'' WHERE id = ''<your-uuid>'';' AS next_step;
