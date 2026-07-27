-- =============================================================================
-- OPTIONAL step — only if an older FEATURES_EXTENSION.sql failed mid-way.
--
-- Normally: run FULL_SETUP.sql once, then run FEATURES_EXTENSION.sql (fixed
-- order: columns before effective_client_id).
--
-- Use THIS file first only when you need columns to exist before re-running
-- the rest of FEATURES_EXTENSION.sql manually.
--
-- Requires: public.profiles and public.projects from FULL_SETUP.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_portal_visit TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_account_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_primary_account ON public.profiles(primary_account_id);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_renews_at DATE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS launch_date DATE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS lead_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS next_action_label TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS next_action_cta_label TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS next_action_href TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_lead_admin ON public.projects(lead_admin_id);

CREATE INDEX IF NOT EXISTS idx_projects_contract_renews ON public.projects(contract_renews_at);

SELECT 'Prerequisite columns ready. Now run supabase/FEATURES_EXTENSION.sql in full.' AS next_step;
