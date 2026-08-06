-- CI Builder: Figma OAuth connections, guideline source link, import audit

-- 1. Per-user Figma connection (OAuth or personal access token)
CREATE TABLE IF NOT EXISTS public.ci_figma_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  figma_user_id TEXT,
  figma_email TEXT,
  figma_handle TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  auth_method TEXT NOT NULL DEFAULT 'oauth'
    CHECK (auth_method IN ('oauth', 'pat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.ci_figma_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own figma connections" ON public.ci_figma_connections;
CREATE POLICY "Users manage own figma connections"
  ON public.ci_figma_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all figma connections" ON public.ci_figma_connections;
CREATE POLICY "Admins read all figma connections"
  ON public.ci_figma_connections
  FOR SELECT
  USING (public.get_user_role() IN ('admin', 'superadmin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_figma_connections TO authenticated;

-- 2. Link guideline to source Figma file (future sync)
ALTER TABLE public.ci_guidelines
  ADD COLUMN IF NOT EXISTS figma_file_key TEXT,
  ADD COLUMN IF NOT EXISTS figma_file_name TEXT,
  ADD COLUMN IF NOT EXISTS figma_file_version TEXT,
  ADD COLUMN IF NOT EXISTS figma_team_id TEXT,
  ADD COLUMN IF NOT EXISTS figma_project_id TEXT,
  ADD COLUMN IF NOT EXISTS figma_last_imported_at TIMESTAMPTZ;

-- 3. Re-create import audit (dropped earlier; unused until now)
CREATE TABLE IF NOT EXISTS public.ci_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id UUID NOT NULL REFERENCES public.ci_guidelines(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'json'
    CHECK (source IN ('json', 'figma')),
  raw_payload JSONB,
  parse_report JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ci_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to imports" ON public.ci_imports;
CREATE POLICY "Admins have full access to imports"
  ON public.ci_imports
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_imports TO authenticated;

CREATE INDEX IF NOT EXISTS ci_imports_guideline_id_idx ON public.ci_imports (guideline_id);
CREATE INDEX IF NOT EXISTS ci_guidelines_figma_file_key_idx ON public.ci_guidelines (figma_file_key)
  WHERE figma_file_key IS NOT NULL;
