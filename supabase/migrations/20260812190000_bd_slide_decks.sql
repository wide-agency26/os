-- Phase 6: Slide decks for BD Proposal Builder
CREATE TABLE IF NOT EXISTS public.bd_slide_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bd_record_id UUID REFERENCES public.bd_records(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Proposal deck',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'accepted', 'declined', 'on_hold', 'archived')),
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_ids UUID[] NOT NULL DEFAULT '{}',
  public_slug TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bd_slide_decks_bd_record_id_idx ON public.bd_slide_decks (bd_record_id);
CREATE INDEX IF NOT EXISTS bd_slide_decks_company_id_idx ON public.bd_slide_decks (company_id);

ALTER TABLE public.bd_slide_decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage bd slide decks" ON public.bd_slide_decks;
CREATE POLICY "Staff manage bd slide decks" ON public.bd_slide_decks
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager'));

DROP POLICY IF EXISTS "Public read published slide decks" ON public.bd_slide_decks;
CREATE POLICY "Public read published slide decks" ON public.bd_slide_decks
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND public_slug IS NOT NULL);
