-- =============================================================================
-- Client Report Viewer access
-- projects.client_id = crm_customers.id (via company_members), not auth.uid()
-- =============================================================================

-- datasets: clients read rows for active company projects
DROP POLICY IF EXISTS "Clients can view own project datasets" ON public.datasets;
CREATE POLICY "Clients can view company project datasets"
  ON public.datasets
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'superadmin')
    OR project_id IN (
      SELECT p.id
      FROM public.projects p
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- Expand admin policy to cover founder-tier staff roles used in the app
DROP POLICY IF EXISTS "Admins have full access to datasets" ON public.datasets;
CREATE POLICY "Staff have full access to datasets"
  ON public.datasets
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  )
  WITH CHECK (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  );

-- dataset_rows
DROP POLICY IF EXISTS "Clients can view own dataset rows" ON public.dataset_rows;
CREATE POLICY "Clients can view company dataset rows"
  ON public.dataset_rows
  FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() IN ('admin', 'superadmin')
    OR dataset_id IN (
      SELECT d.id
      FROM public.datasets d
      JOIN public.projects p ON p.id = d.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins have full access to dataset rows" ON public.dataset_rows;
CREATE POLICY "Staff have full access to dataset rows"
  ON public.dataset_rows
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  )
  WITH CHECK (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  );

-- Clients may read visible AI insights for their company projects (read-only)
DROP POLICY IF EXISTS "Auth manage ai insights" ON public.project_ai_insights;
CREATE POLICY "Staff manage ai insights"
  ON public.project_ai_insights
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  )
  WITH CHECK (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  );

CREATE POLICY "Clients read visible ai insights"
  ON public.project_ai_insights
  FOR SELECT
  TO authenticated
  USING (
    visible = true
    AND project_id IN (
      SELECT p.id
      FROM public.projects p
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- Clients may read funnel configs (needed to render General) but not mutate
DROP POLICY IF EXISTS "Auth manage funnel configs" ON public.project_funnel_configs;
CREATE POLICY "Staff manage funnel configs"
  ON public.project_funnel_configs
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  )
  WITH CHECK (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  );

CREATE POLICY "Clients read funnel configs"
  ON public.project_funnel_configs
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id
      FROM public.projects p
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- Escalation inbox for "Contact Agency" from Ask AI
CREATE TABLE IF NOT EXISTS public.client_report_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab TEXT NOT NULL DEFAULT 'General',
  date_range TEXT,
  question TEXT NOT NULL,
  thread_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_report_escalations_project_idx
  ON public.client_report_escalations (project_id, created_at DESC);

ALTER TABLE public.client_report_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients insert own escalations"
  ON public.client_report_escalations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND project_id IN (
      SELECT p.id
      FROM public.projects p
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "Clients read own escalations"
  ON public.client_report_escalations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff manage escalations"
  ON public.client_report_escalations
  FOR ALL
  TO authenticated
  USING (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  )
  WITH CHECK (
    public.get_user_role() IN (
      'admin', 'superadmin', 'client_manager', 'bd_manager', 'hr_manager', 'accountant'
    )
  );

GRANT SELECT, INSERT ON public.client_report_escalations TO authenticated;
GRANT ALL ON public.client_report_escalations TO service_role;

NOTIFY pgrst, 'reload schema';
