-- =============================================================================
-- Report publish workflow: draft (admin-only) vs published (client-visible)
-- =============================================================================

ALTER TABLE public.published_reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published'));

ALTER TABLE public.published_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.published_reports
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Existing rows were treated as live client reports
UPDATE public.published_reports
SET status = 'published'
WHERE published_at IS NOT NULL AND status = 'draft';

CREATE OR REPLACE FUNCTION public.set_published_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_published_reports_updated ON public.published_reports;
CREATE TRIGGER trg_published_reports_updated
  BEFORE UPDATE ON public.published_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_published_reports_updated_at();

-- RLS: clients only see published reports for their companies
DROP POLICY IF EXISTS "Clients can view own published project report" ON public.published_reports;
DROP POLICY IF EXISTS "Admins have full access to published reports" ON public.published_reports;
DROP POLICY IF EXISTS "Clients view published reports" ON public.published_reports;
DROP POLICY IF EXISTS "Staff manage published reports" ON public.published_reports;

CREATE POLICY "Clients view published reports"
  ON public.published_reports
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND project_id IN (
      SELECT p.id
      FROM public.projects p
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "Staff manage published reports"
  ON public.published_reports
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

NOTIFY pgrst, 'reload schema';
