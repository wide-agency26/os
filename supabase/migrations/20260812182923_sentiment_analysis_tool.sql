-- Standalone Sentiment Analysis tool + BD linkage
CREATE TABLE IF NOT EXISTS public.sentiment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_slug TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('running', 'ready', 'failed')),
  score INT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  bd_record_id UUID REFERENCES public.bd_records(id) ON DELETE SET NULL,
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sentiment_reports_slug_idx ON public.sentiment_reports (public_slug);
CREATE INDEX IF NOT EXISTS sentiment_reports_bd_idx ON public.sentiment_reports (bd_record_id);

ALTER TABLE public.sentiment_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.sentiment_reports TO authenticated;
REVOKE DELETE ON public.sentiment_reports FROM authenticated;

DROP POLICY IF EXISTS "Staff manage sentiment_reports" ON public.sentiment_reports;
CREATE POLICY "Staff manage sentiment_reports"
  ON public.sentiment_reports FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

NOTIFY pgrst, 'reload schema';
