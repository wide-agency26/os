-- =============================================================================
-- WIDE Portal — Migration: Company-Scoped Client Access & RLS Policies
-- Migration: 20260804210000_company_members_access.sql
-- =============================================================================

-- 1. Create company_members table
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

-- Enable RLS on company_members
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Staff/Admins have full access on company_members
CREATE POLICY "Admins have full access to company_members"
  ON public.company_members FOR ALL
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

-- Clients can view their own company_memberships
CREATE POLICY "Users can view own company_members"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Clients can request self-service membership for themselves in pending status
CREATE POLICY "Users can request self-service company_members"
  ON public.company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() 
    AND status = 'pending' 
    AND source = 'self_service'
  );

-- 2. Update ci_guidelines RLS policies for company-scoped client access
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

-- 3. Update ci_guideline_versions RLS policy
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

-- 4. Update ci_assets RLS policy
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
