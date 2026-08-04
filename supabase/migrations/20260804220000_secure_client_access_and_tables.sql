-- =============================================================================
-- WIDE Portal — Migration: Secure Client Access & Company Members Table Creation
-- Migration: 20260804220000_secure_client_access_and_tables.sql
-- =============================================================================

-- 1. Create company_members table if not exists
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'self_service' CHECK (source IN ('self_service', 'admin_added')),
  UNIQUE (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_status ON public.company_members(status);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- company_members RLS Policies
DROP POLICY IF EXISTS "Admins have full access to company_members" ON public.company_members;
CREATE POLICY "Admins have full access to company_members"
  ON public.company_members FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

DROP POLICY IF EXISTS "Users can view own company_members" ON public.company_members;
CREATE POLICY "Users can view own company_members"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can request self-service company_members" ON public.company_members;
CREATE POLICY "Users can request self-service company_members"
  ON public.company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND status = 'pending' 
    AND source = 'self_service'
  );

-- 2. TIGHTEN STAFF-ONLY TABLES RLS (crm_customers & projects)

-- Replace catch-all policies on crm_customers
DROP POLICY IF EXISTS "Enable all access for authenticated users on crm_customers" ON public.crm_customers;
DROP POLICY IF EXISTS "Admins have full access to crm_customers" ON public.crm_customers;
CREATE POLICY "Admins have full access to crm_customers"
  ON public.crm_customers FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

-- Allow clients to SELECT minimum company name info for directory lookup in company picker
DROP POLICY IF EXISTS "Clients can select company names for lookup" ON public.crm_customers;
CREATE POLICY "Clients can select company names for lookup"
  ON public.crm_customers FOR SELECT
  TO authenticated
  USING (true);

-- Replace catch-all policies on projects
DROP POLICY IF EXISTS "Enable all access for authenticated users on projects" ON public.projects;
DROP POLICY IF EXISTS "Public can view projects with published guidelines" ON public.projects;
DROP POLICY IF EXISTS "Admins have full access to projects" ON public.projects;

CREATE POLICY "Admins have full access to projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

-- 3. CLIENT BRAND GUIDELINE TABLES RLS (company-scoped)
DROP POLICY IF EXISTS "Clients can view published guidelines for active companies" ON public.ci_guidelines;
CREATE POLICY "Clients can view published guidelines for active companies"
  ON public.ci_guidelines FOR SELECT
  TO authenticated
  USING (
    status = 'published' AND (
      public.get_user_role() IN ('admin', 'superadmin')
      OR project_id IN (
        SELECT p.id FROM public.projects p
        JOIN public.company_members cm ON cm.company_id = p.client_id
        WHERE cm.user_id = auth.uid() AND cm.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Clients can view published versions for active companies" ON public.ci_guideline_versions;
CREATE POLICY "Clients can view published versions for active companies"
  ON public.ci_guideline_versions FOR SELECT
  TO authenticated
  USING (
    is_published = true AND (
      public.get_user_role() IN ('admin', 'superadmin')
      OR guideline_id IN (
        SELECT g.id FROM public.ci_guidelines g
        JOIN public.projects p ON p.id = g.project_id
        JOIN public.company_members cm ON cm.company_id = p.client_id
        WHERE cm.user_id = auth.uid() AND cm.status = 'active' AND g.status = 'published'
      )
    )
  );

DROP POLICY IF EXISTS "Clients can view assets for active companies" ON public.ci_assets;
CREATE POLICY "Clients can view assets for active companies"
  ON public.ci_assets FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'superadmin')
    OR guideline_id IN (
      SELECT g.id FROM public.ci_guidelines g
      JOIN public.projects p ON p.id = g.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active' AND g.status = 'published'
    )
  );

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
