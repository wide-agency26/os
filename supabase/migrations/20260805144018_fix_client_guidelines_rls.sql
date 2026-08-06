-- =============================================================================
-- Fix client brand-guidelines visibility
-- Clients list guidelines via: ci_guidelines ⋈ projects ⋈ crm_customers
-- RLS already allowed published ci_guidelines for active company_members, but
-- projects had admin-only policies — the !inner join returned zero rows.
-- =============================================================================

-- Clients can read projects for companies they actively belong to
DROP POLICY IF EXISTS "Clients can view projects for active companies" ON public.projects;
CREATE POLICY "Clients can view projects for active companies"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'superadmin')
    OR client_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- Drop obsolete policy that treated projects.client_id as auth.uid() (wrong — it's crm_customers.id)
DROP POLICY IF EXISTS "Clients can view their project's guideline" ON public.ci_guidelines;

-- Clients can read published guideline sections for their companies (defense in depth;
-- public /g/[slug] uses a published version snapshot via service role)
DROP POLICY IF EXISTS "Clients can view sections for published company guidelines" ON public.ci_sections;
CREATE POLICY "Clients can view sections for published company guidelines"
  ON public.ci_sections
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'superadmin')
    OR guideline_id IN (
      SELECT g.id
      FROM public.ci_guidelines g
      JOIN public.projects p ON p.id = g.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND g.status = 'published'
    )
  );

NOTIFY pgrst, 'reload schema';
