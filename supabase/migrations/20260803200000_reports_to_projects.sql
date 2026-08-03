-- =============================================================================
-- WIDE Portal — Migration: Reports mapped to Projects
-- Migration: 20260803200000_reports_to_projects.sql
-- =============================================================================

-- We must truncate the existing tables because they currently reference client_id
-- and cannot be automatically mapped to a project_id safely without data loss.
TRUNCATE TABLE public.marketing_metrics;
TRUNCATE TABLE public.published_reports;

-- 1. Alter marketing_metrics to reference project_id
ALTER TABLE public.marketing_metrics DROP COLUMN client_id;
ALTER TABLE public.marketing_metrics ADD COLUMN project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE;

-- Drop and recreate the unique constraint for CSV upserts
ALTER TABLE public.marketing_metrics DROP CONSTRAINT IF EXISTS marketing_metrics_unique_row;
ALTER TABLE public.marketing_metrics ADD CONSTRAINT marketing_metrics_unique_row UNIQUE (project_id, date, stage, metric_name);

-- Update RLS policies for marketing_metrics
DROP POLICY IF EXISTS "Clients can view own metrics" ON public.marketing_metrics;
CREATE POLICY "Clients can view own project metrics"
  ON public.marketing_metrics
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

-- 2. Alter published_reports to reference project_id
ALTER TABLE public.published_reports DROP CONSTRAINT published_reports_client_id_key;
ALTER TABLE public.published_reports DROP COLUMN client_id;
ALTER TABLE public.published_reports ADD COLUMN project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE;

-- Update RLS policies for published_reports
DROP POLICY IF EXISTS "Clients can view own published report" ON public.published_reports;
CREATE POLICY "Clients can view own published project report"
  ON public.published_reports
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );
