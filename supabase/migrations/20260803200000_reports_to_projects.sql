-- =============================================================================
-- WIDE Portal — Migration: Reports mapped to Projects (Final)
-- Migration: 20260803200000_reports_to_projects.sql
-- =============================================================================

-- Safely drop existing tables if they exist to avoid missing relation errors
-- Since we are pivoting to projects, we don't need to preserve old client-based mock data
DROP TABLE IF EXISTS public.marketing_metrics CASCADE;
DROP TABLE IF EXISTS public.published_reports CASCADE;

-- 1. Create marketing_metrics
CREATE TABLE public.marketing_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Awareness', 'Consideration', 'Conversion', 'Advocacy')),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add Unique Constraint to enable idempotent CSV Upserts
ALTER TABLE public.marketing_metrics 
  ADD CONSTRAINT marketing_metrics_unique_row UNIQUE (project_id, date, stage, metric_name);

-- Enable RLS on marketing_metrics
ALTER TABLE public.marketing_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own project metrics"
  ON public.marketing_metrics
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to metrics"
  ON public.marketing_metrics
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 2. Create published_reports
CREATE TABLE public.published_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- stores chart selections, date ranges, etc.
  published_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on published_reports
ALTER TABLE public.published_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own published project report"
  ON public.published_reports
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to published reports"
  ON public.published_reports
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
