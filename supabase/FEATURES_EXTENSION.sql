-- =============================================================================
-- WIDE Portal — Feature extension (run AFTER supabase/FULL_SETUP.sql)
-- Dashboard attention, renewals, activity, vault + versions, style guide web,
-- announcements, notification prefs, team accounts, project lead assignment.
--
-- Column ALTERs run before effective_client_id() so PostgreSQL never sees a
-- missing profiles.primary_account_id. Optional split file:
-- PREREQUISITE_BEFORE_FEATURES_EXTENSION.sql (same ALTERs only).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Columns FIRST (functions below reference these — e.g. primary_account_id)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Effective client id (team members access owner's workspace)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Activity feed
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Vault files (categorized, versioned)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Download read receipts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_downloads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id        UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  downloaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_downloads_file ON public.vault_downloads(file_id);
CREATE INDEX IF NOT EXISTS idx_vault_downloads_user ON public.vault_downloads(user_id);

-- ---------------------------------------------------------------------------
-- Website style guide (per client)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Global announcements (admin → all clients)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Notification preferences
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Auth signup: optional team invite (primary_account_id in user metadata)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_primary UUID;
  v_meta TEXT;
BEGIN
  v_meta := COALESCE(NEW.raw_user_meta_data ->> 'primary_account_id', '');
  v_primary := NULL;
  IF v_meta <> '' THEN
    BEGIN
      v_primary := v_meta::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      v_primary := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, company_name, primary_account_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'company_name', '')), ''),
    v_primary
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    company_name = COALESCE(EXCLUDED.company_name, public.profiles.company_name),
    primary_account_id = COALESCE(EXCLUDED.primary_account_id, public.profiles.primary_account_id),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: replace client-scoped policies to use effective_client_id()
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
CREATE POLICY "Clients can view own projects"
  ON public.projects FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Clients can view own brand hub" ON public.brand_hubs;
CREATE POLICY "Clients can view own brand hub"
  ON public.brand_hubs FOR SELECT
  USING (client_id = public.effective_client_id());

ALTER TABLE public.portal_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_style_guide_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_style_guide_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "Clients read own portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "Clients insert own portal_activity" ON public.portal_activity;

CREATE POLICY "Admins full portal_activity"
  ON public.portal_activity FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Clients read own portal_activity"
  ON public.portal_activity FOR SELECT
  USING (client_id = public.effective_client_id());

-- Inserts via service role / admin bypass; authenticated clients cannot forge feed.
CREATE POLICY "Clients insert own portal_activity"
  ON public.portal_activity FOR INSERT
  WITH CHECK (client_id = public.effective_client_id() AND actor_id = auth.uid());

DROP POLICY IF EXISTS "Admins full vault_files" ON public.vault_files;
DROP POLICY IF EXISTS "Clients read own vault_files" ON public.vault_files;

CREATE POLICY "Admins full vault_files"
  ON public.vault_files FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Clients read own vault_files"
  ON public.vault_files FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Admins full vault_downloads" ON public.vault_downloads;
DROP POLICY IF EXISTS "Clients insert own vault_downloads" ON public.vault_downloads;
DROP POLICY IF EXISTS "Clients read own vault_downloads" ON public.vault_downloads;

CREATE POLICY "Admins full vault_downloads"
  ON public.vault_downloads FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Clients insert own vault_downloads"
  ON public.vault_downloads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.vault_files f
      WHERE f.id = file_id AND f.client_id = public.effective_client_id()
    )
  );

CREATE POLICY "Clients read own vault_downloads"
  ON public.vault_downloads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_files f
      WHERE f.id = file_id AND f.client_id = public.effective_client_id()
    )
  );

DROP POLICY IF EXISTS "Admins full web_style_guide" ON public.web_style_guide_items;
DROP POLICY IF EXISTS "Clients read own web_style_guide" ON public.web_style_guide_items;

CREATE POLICY "Admins full web_style_guide"
  ON public.web_style_guide_items FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Clients read own web_style_guide"
  ON public.web_style_guide_items FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Admins full web_style_guide_snapshots" ON public.web_style_guide_snapshots;
DROP POLICY IF EXISTS "Clients read own web_style_guide_snapshots" ON public.web_style_guide_snapshots;

CREATE POLICY "Admins full web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Clients read own web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Authenticated read active announcements" ON public.global_announcements;
DROP POLICY IF EXISTS "Anyone read active announcements" ON public.global_announcements;
DROP POLICY IF EXISTS "Admins manage announcements" ON public.global_announcements;

CREATE POLICY "Authenticated read active announcements"
  ON public.global_announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND starts_at <= now()
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Admins manage announcements"
  ON public.global_announcements FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;

CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: client-vault bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-vault', 'client-vault', true, 104857600)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "client_vault_public_read" ON storage.objects;
DROP POLICY IF EXISTS "client_vault_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "client_vault_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "client_vault_admin_delete" ON storage.objects;

CREATE POLICY "client_vault_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-vault');

CREATE POLICY "client_vault_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-vault'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "client_vault_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'client-vault' AND public.get_user_role() = 'admin')
  WITH CHECK (bucket_id = 'client-vault' AND public.get_user_role() = 'admin');

CREATE POLICY "client_vault_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'client-vault' AND public.get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Grants (new objects)
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE public.portal_activity TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.vault_files TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.vault_downloads TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.web_style_guide_items TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.web_style_guide_snapshots TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.global_announcements TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_preferences TO postgres, anon, authenticated, service_role;

SELECT 'FEATURES_EXTENSION applied. Rebuild app; use client-vault bucket for vault files.' AS note;
