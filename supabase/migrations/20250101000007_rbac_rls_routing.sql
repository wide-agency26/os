-- =============================================================================
-- WIDE OS — RBAC expansion, client-manager assignments, hardened RLS
-- Migration: 006_rbac_rls_routing.sql
-- =============================================================================
-- Roles (Phase 1 UI): superadmin, client_manager, client
-- Roles (schema-ready, UI later): accountant, prospect
-- Legacy: profiles.role = 'admin' is treated as superadmin in helper functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Role constraint (expand; migrate admin → superadmin)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

UPDATE public.profiles
SET role = 'superadmin'
WHERE role = 'admin';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'superadmin',
    'accountant',
    'client_manager',
    'client',
    'prospect'
  ));

-- ---------------------------------------------------------------------------
-- Client manager ↔ client assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_manager_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_assignments_manager
  ON public.client_manager_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_cm_assignments_client
  ON public.client_manager_assignments(client_id);

ALTER TABLE public.client_manager_assignments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER — read profiles for RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role(), '') IN ('superadmin', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_client_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role() = 'client_manager';
$$;

CREATE OR REPLACE FUNCTION public.is_agency_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role(), '') IN (
    'superadmin', 'admin', 'client_manager', 'accountant'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_client_id IS NULL THEN false
    WHEN public.is_superadmin() THEN true
    WHEN public.get_user_role() = 'client' THEN
      target_client_id = public.effective_client_id()
    WHEN public.get_user_role() = 'client_manager' THEN (
      EXISTS (
        SELECT 1
        FROM public.client_manager_assignments a
        WHERE a.manager_id = auth.uid()
          AND a.client_id = target_client_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.client_id = target_client_id
          AND p.lead_admin_id = auth.uid()
      )
    )
    ELSE false
  END;
$$;

-- Storage path prefix: {client_id}/...
CREATE OR REPLACE FUNCTION public.storage_object_client_id(object_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(split_part(object_name, '/', 1), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- RLS: client_manager_assignments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmin manage cm assignments" ON public.client_manager_assignments;
DROP POLICY IF EXISTS "CM read own assignments" ON public.client_manager_assignments;

CREATE POLICY "Superadmin manage cm assignments"
  ON public.client_manager_assignments
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM read own assignments"
  ON public.client_manager_assignments
  FOR SELECT
  USING (manager_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Clients view workspace owner profile"
  ON public.profiles
  FOR SELECT
  USING (id = public.effective_client_id());

CREATE POLICY "Agency staff view assigned client profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.is_client_manager()
    AND public.can_access_client(id)
    AND role = 'client'
  );

CREATE POLICY "Superadmin full access profiles"
  ON public.profiles
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- RLS: projects, brand_hubs (replace admin-only staff policies)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins have full access to projects" ON public.projects;
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;

CREATE POLICY "Clients view own projects"
  ON public.projects
  FOR SELECT
  USING (client_id = public.effective_client_id());

CREATE POLICY "Superadmin full access projects"
  ON public.projects
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned projects"
  ON public.projects
  FOR ALL
  USING (
    public.is_client_manager()
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager()
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS "Admins have full access to brand hubs" ON public.brand_hubs;
DROP POLICY IF EXISTS "Clients can view own brand hub" ON public.brand_hubs;

CREATE POLICY "Clients view own brand hub"
  ON public.brand_hubs
  FOR SELECT
  USING (client_id = public.effective_client_id());

CREATE POLICY "Superadmin full access brand hubs"
  ON public.brand_hubs
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned brand hubs"
  ON public.brand_hubs
  FOR ALL
  USING (
    public.is_client_manager()
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager()
    AND public.can_access_client(client_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: feature tables (portal_activity, vault, style guides)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins full portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "Clients read own portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "Clients insert own portal_activity" ON public.portal_activity;

CREATE POLICY "Superadmin full portal_activity"
  ON public.portal_activity FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned portal_activity"
  ON public.portal_activity FOR ALL
  USING (
    public.is_client_manager() AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager() AND public.can_access_client(client_id)
  );

CREATE POLICY "Clients read own portal_activity"
  ON public.portal_activity FOR SELECT
  USING (client_id = public.effective_client_id());

CREATE POLICY "Clients insert own portal_activity"
  ON public.portal_activity FOR INSERT
  WITH CHECK (
    client_id = public.effective_client_id() AND actor_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins full vault_files" ON public.vault_files;
DROP POLICY IF EXISTS "Clients read own vault_files" ON public.vault_files;

CREATE POLICY "Superadmin full vault_files"
  ON public.vault_files FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned vault_files"
  ON public.vault_files FOR ALL
  USING (
    public.is_client_manager() AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager() AND public.can_access_client(client_id)
  );

CREATE POLICY "Clients read own vault_files"
  ON public.vault_files FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Admins full vault_downloads" ON public.vault_downloads;
DROP POLICY IF EXISTS "Clients insert own vault_downloads" ON public.vault_downloads;
DROP POLICY IF EXISTS "Clients read own vault_downloads" ON public.vault_downloads;

CREATE POLICY "Superadmin full vault_downloads"
  ON public.vault_downloads FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM read assigned vault_downloads"
  ON public.vault_downloads FOR SELECT
  USING (
    public.is_client_manager()
    AND EXISTS (
      SELECT 1 FROM public.vault_files f
      WHERE f.id = file_id AND public.can_access_client(f.client_id)
    )
  );

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

CREATE POLICY "Superadmin full web_style_guide"
  ON public.web_style_guide_items FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned web_style_guide"
  ON public.web_style_guide_items FOR ALL
  USING (
    public.is_client_manager() AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager() AND public.can_access_client(client_id)
  );

CREATE POLICY "Clients read own web_style_guide"
  ON public.web_style_guide_items FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Admins full web_style_guide_snapshots" ON public.web_style_guide_snapshots;
DROP POLICY IF EXISTS "Clients read own web_style_guide_snapshots" ON public.web_style_guide_snapshots;

CREATE POLICY "Superadmin full web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR ALL
  USING (
    public.is_client_manager() AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager() AND public.can_access_client(client_id)
  );

CREATE POLICY "Clients read own web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Admins manage announcements" ON public.global_announcements;

CREATE POLICY "Superadmin manage announcements"
  ON public.global_announcements FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- Storage: client-vault — scope writes to superadmin + assigned CM
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_vault_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "client_vault_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "client_vault_admin_delete" ON storage.objects;

CREATE POLICY "client_vault_staff_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-vault'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  );

CREATE POLICY "client_vault_staff_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'client-vault'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  )
  WITH CHECK (
    bucket_id = 'client-vault'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  );

CREATE POLICY "client_vault_staff_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-vault'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  );

-- brand-guidelines bucket (migration 003) — same staff model
DROP POLICY IF EXISTS "brand_guidelines_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_delete" ON storage.objects;

CREATE POLICY "brand_guidelines_staff_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-guidelines'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  );

CREATE POLICY "brand_guidelines_staff_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'brand-guidelines'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  )
  WITH CHECK (
    bucket_id = 'brand-guidelines'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  );

CREATE POLICY "brand_guidelines_staff_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'brand-guidelines'
    AND (
      public.is_superadmin()
      OR (
        public.is_client_manager()
        AND public.can_access_client(public.storage_object_client_id(name))
      )
    )
  );

GRANT ALL ON TABLE public.client_manager_assignments
  TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.can_access_client(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.effective_client_id() TO authenticated;
