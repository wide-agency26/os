-- Standalone SEO Audit tool (shareable reports) + optional BD record link
CREATE TABLE IF NOT EXISTS public.seo_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('running', 'ready', 'failed')),
  score INT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  competitor_url TEXT,
  bd_record_id UUID REFERENCES public.bd_records(id) ON DELETE SET NULL,
  error_message TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_audits_slug_idx ON public.seo_audits (public_slug);
CREATE INDEX IF NOT EXISTS seo_audits_bd_record_idx ON public.seo_audits (bd_record_id);
CREATE INDEX IF NOT EXISTS seo_audits_created_idx ON public.seo_audits (created_at DESC);

ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.seo_audits TO authenticated;
REVOKE DELETE ON public.seo_audits FROM authenticated;
REVOKE DELETE ON public.seo_audits FROM anon;

-- Staff full access
DROP POLICY IF EXISTS "Staff manage seo_audits" ON public.seo_audits;
CREATE POLICY "Staff manage seo_audits"
  ON public.seo_audits
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

-- Public read of ready audits via service role in app (no anon SELECT needed)

NOTIFY pgrst, 'reload schema';
