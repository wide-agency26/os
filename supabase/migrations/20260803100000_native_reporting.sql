-- =============================================================================
-- WIDE Portal — Native Reporting Updates
-- Migration: 20260803100000_native_reporting.sql
-- =============================================================================

-- 1. Ensure `marketing_metrics` exists (if not already created by user)
CREATE TABLE IF NOT EXISTS public.marketing_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL,
  date DATE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('Awareness', 'Consideration', 'Conversion', 'Advocacy')),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add Unique Constraint to enable idempotent CSV Upserts
ALTER TABLE public.marketing_metrics 
  DROP CONSTRAINT IF EXISTS marketing_metrics_unique_row;
ALTER TABLE public.marketing_metrics 
  ADD CONSTRAINT marketing_metrics_unique_row UNIQUE (client_id, date, stage, metric_name);

-- 3. Enable RLS on marketing_metrics
ALTER TABLE public.marketing_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own metrics"
  ON public.marketing_metrics
  FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Admins have full access to metrics"
  ON public.marketing_metrics
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 4. Create `published_reports` to save layouts
CREATE TABLE IF NOT EXISTS public.published_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) NOT NULL UNIQUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb, -- stores chart selections, date ranges, etc.
  published_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- 5. Enable RLS on published_reports
ALTER TABLE public.published_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own published report"
  ON public.published_reports
  FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Admins have full access to published reports"
  ON public.published_reports
  FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- 6. Trigger for updated_at
CREATE TRIGGER set_marketing_metrics_updated_at
  BEFORE UPDATE ON public.marketing_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
