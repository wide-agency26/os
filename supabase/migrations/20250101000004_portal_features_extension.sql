-- =============================================================================
-- Portal feature tables + effective_client_id (required before 006 RBAC policies)
-- Sourced from supabase/FEATURES_EXTENSION.sql (tables only; RLS in 006+)
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

CREATE OR REPLACE FUNCTION public.effective_client_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.primary_account_id
     FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.primary_account_id IS NOT NULL),
    auth.uid()
  );
$$;

CREATE TABLE IF NOT EXISTS public.portal_activity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title      TEXT NOT NULL,
  meta       JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_activity_client_created
  ON public.portal_activity(client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vault_files (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  folder_key       TEXT NOT NULL DEFAULT 'general',
  category         TEXT NOT NULL DEFAULT 'General',
  label            TEXT NOT NULL,
  storage_path     TEXT,
  external_url     TEXT,
  external_provider TEXT,
  file_name        TEXT NOT NULL,
  mime_type        TEXT,
  size_bytes       BIGINT,
  version          INT NOT NULL DEFAULT 1,
  is_current       BOOLEAN NOT NULL DEFAULT true,
  replaces_file_id UUID REFERENCES public.vault_files(id) ON DELETE SET NULL,
  is_legal         BOOLEAN NOT NULL DEFAULT false,
  uploaded_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_files_client_folder
  ON public.vault_files(client_id, folder_key);
CREATE INDEX IF NOT EXISTS idx_vault_files_client_current
  ON public.vault_files(client_id, is_current) WHERE is_current = true;

ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS external_provider TEXT;
ALTER TABLE public.vault_files ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.vault_files DROP CONSTRAINT IF EXISTS vault_files_storage_or_external;
ALTER TABLE public.vault_files ADD CONSTRAINT vault_files_storage_or_external CHECK (
  (
    external_url IS NULL
    AND storage_path IS NOT NULL
    AND length(trim(storage_path)) > 0
  )
  OR (
    external_url IS NOT NULL
    AND length(trim(external_url)) > 0
    AND trim(external_url) LIKE 'https://%'
  )
);

CREATE TABLE IF NOT EXISTS public.vault_downloads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id        UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  downloaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_downloads_file ON public.vault_downloads(file_id);
CREATE INDEX IF NOT EXISTS idx_vault_downloads_user ON public.vault_downloads(user_id);

CREATE TABLE IF NOT EXISTS public.web_style_guide_items (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL,
  component_kind         TEXT NOT NULL DEFAULT 'component',
  screenshot_storage_path TEXT,
  staging_url            TEXT,
  why_notes              TEXT,
  dos                    TEXT,
  donts                  TEXT,
  sort_order             INT NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_style_guide_client ON public.web_style_guide_items(client_id, sort_order);

DROP TRIGGER IF EXISTS set_web_style_guide_items_updated_at ON public.web_style_guide_items;
CREATE TRIGGER set_web_style_guide_items_updated_at
  BEFORE UPDATE ON public.web_style_guide_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.web_style_guide_snapshots (
  client_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_class            TEXT NOT NULL DEFAULT '',
  html_fragment         TEXT NOT NULL DEFAULT '',
  stylesheet_hrefs      JSONB NOT NULL DEFAULT '[]'::jsonb,
  inline_head_styles    TEXT NOT NULL DEFAULT '',
  style_guide_document  JSONB,
  pdf_notes             TEXT,
  source_filename       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.web_style_guide_snapshots
  ADD COLUMN IF NOT EXISTS style_guide_document JSONB;

CREATE INDEX IF NOT EXISTS idx_web_style_guide_snapshots_updated
  ON public.web_style_guide_snapshots(updated_at DESC);

DROP TRIGGER IF EXISTS set_web_style_guide_snapshots_updated_at ON public.web_style_guide_snapshots;
CREATE TRIGGER set_web_style_guide_snapshots_updated_at
  BEFORE UPDATE ON public.web_style_guide_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.global_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body       TEXT NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_global_announcements_active
  ON public.global_announcements(is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id            UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_email       BOOLEAN NOT NULL DEFAULT true,
  notify_sms         BOOLEAN NOT NULL DEFAULT false,
  notify_in_app      BOOLEAN NOT NULL DEFAULT true,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER set_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-vault', 'client-vault', true, 104857600)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

GRANT EXECUTE ON FUNCTION public.effective_client_id() TO authenticated;
