-- =============================================================================
-- WIDE Portal — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================
-- This migration creates the core tables for the WIDE agency portal:
--   1. profiles  — User profiles linked to auth.users
--   2. projects  — Client projects with status tracking
--   3. brand_hubs — Brand assets per client (colors, typography, logo)
--
-- Security model:
--   - All tables have RLS enabled
--   - 'client' role: SELECT only where client_id = auth.uid()
--   - 'admin' role: Full CRUD (SELECT, INSERT, UPDATE, DELETE)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  company_name TEXT,
  role        TEXT NOT NULL DEFAULT 'client'
              CHECK (role IN ('client', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper: get the role of the currently authenticated user from their profile
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Clients can read their own profile
CREATE POLICY "Clients can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
  );

-- Admins can do everything on profiles
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles
  FOR ALL
  USING (
    public.get_user_role() = 'admin'
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 2. PROJECTS
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  scope       TEXT,
  status      TEXT NOT NULL DEFAULT 'running'
              CHECK (status IN ('running', 'expired', 'completed')),
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast client lookups
CREATE INDEX idx_projects_client_id ON public.projects(client_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Clients can only see their own projects
CREATE POLICY "Clients can view own projects"
  ON public.projects
  FOR SELECT
  USING (
    client_id = auth.uid()
  );

-- Admins can do everything on projects
CREATE POLICY "Admins have full access to projects"
  ON public.projects
  FOR ALL
  USING (
    public.get_user_role() = 'admin'
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
  );


-- ---------------------------------------------------------------------------
-- 3. BRAND HUBS
-- ---------------------------------------------------------------------------
CREATE TABLE public.brand_hubs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_colors  JSONB DEFAULT '[]'::jsonb,
  typography    JSONB DEFAULT '{}'::jsonb,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast client lookups
CREATE INDEX idx_brand_hubs_client_id ON public.brand_hubs(client_id);

-- Enable RLS
ALTER TABLE public.brand_hubs ENABLE ROW LEVEL SECURITY;

-- Clients can only see their own brand hub
CREATE POLICY "Clients can view own brand hub"
  ON public.brand_hubs
  FOR SELECT
  USING (
    client_id = auth.uid()
  );

-- Admins can do everything on brand hubs
CREATE POLICY "Admins have full access to brand hubs"
  ON public.brand_hubs
  FOR ALL
  USING (
    public.get_user_role() = 'admin'
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
  );


-- ---------------------------------------------------------------------------
-- Auto-update `updated_at` timestamp on row changes
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

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_brand_hubs_updated_at
  BEFORE UPDATE ON public.brand_hubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
