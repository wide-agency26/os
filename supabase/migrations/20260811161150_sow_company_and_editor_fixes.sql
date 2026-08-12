-- =============================================================================
-- SOW: company-first (prospect/lead/client), conservative block, portfolio kinds
-- =============================================================================

-- 1. Company ownership (required going forward); project optional until deal converts
ALTER TABLE public.sows
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.crm_customers(id) ON DELETE RESTRICT;

-- Backfill company from linked project when present
UPDATE public.sows s
SET company_id = p.client_id
FROM public.projects p
WHERE s.project_id = p.id
  AND s.company_id IS NULL
  AND p.client_id IS NOT NULL;

-- Drop NOT NULL on project_id (SOW starts on company, project comes after agreement)
ALTER TABLE public.sows
  ALTER COLUMN project_id DROP NOT NULL;

-- For any remaining rows without company, leave nullable temporarily then enforce
-- Prefer companies only; if orphaned, keep null for staff cleanup
CREATE INDEX IF NOT EXISTS sows_company_id_idx ON public.sows (company_id);

-- 2. Editable conservative callout (client-visible)
ALTER TABLE public.sows
  ADD COLUMN IF NOT EXISTS show_conservative_block BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conservative_eyebrow TEXT NOT NULL DEFAULT 'Conservative scope',
  ADD COLUMN IF NOT EXISTS conservative_body TEXT NOT NULL DEFAULT 'Up to {{revision_rounds}} rounds of revisions are included for design and creative review. Anything not listed below is out of scope.';

-- 3. Portfolio slides: scraped WIDE projects OR uploaded screenshots
ALTER TABLE public.sow_portfolio_slides
  ADD COLUMN IF NOT EXISTS slide_kind TEXT NOT NULL DEFAULT 'scraped'
    CHECK (slide_kind IN ('scraped', 'screenshot')),
  ADD COLUMN IF NOT EXISTS link_url TEXT;

UPDATE public.sow_portfolio_slides
SET link_url = source_url
WHERE link_url IS NULL;

-- Allow empty source_url for pure screenshots (link_url holds the web link)
ALTER TABLE public.sow_portfolio_slides
  ALTER COLUMN source_url DROP NOT NULL;

ALTER TABLE public.sow_portfolio_slides
  ALTER COLUMN source_url SET DEFAULT '';

-- 4. Storage bucket for SOW screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sow-assets',
  'sow-assets',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff upload sow assets" ON storage.objects;
CREATE POLICY "Staff upload sow assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sow-assets'
    AND (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  );

DROP POLICY IF EXISTS "Staff update sow assets" ON storage.objects;
CREATE POLICY "Staff update sow assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sow-assets'
    AND (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  );

DROP POLICY IF EXISTS "Staff delete sow assets" ON storage.objects;
CREATE POLICY "Staff delete sow assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sow-assets'
    AND (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  );

DROP POLICY IF EXISTS "Public read sow assets" ON storage.objects;
CREATE POLICY "Public read sow assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'sow-assets');

-- 5. RLS: clients see published SOWs for their company (not via project only)
DROP POLICY IF EXISTS "Clients view published sows" ON public.sows;
CREATE POLICY "Clients view published sows"
  ON public.sows
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    AND company_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Clients view published sow sections" ON public.sow_sections;
CREATE POLICY "Clients view published sow sections"
  ON public.sow_sections FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id FROM public.sows s
      JOIN public.company_members cm ON cm.company_id = s.company_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active' AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Clients view published sow cost groups" ON public.sow_cost_groups;
CREATE POLICY "Clients view published sow cost groups"
  ON public.sow_cost_groups FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id FROM public.sows s
      JOIN public.company_members cm ON cm.company_id = s.company_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active' AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Clients view published sow line items" ON public.sow_line_items;
CREATE POLICY "Clients view published sow line items"
  ON public.sow_line_items FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id FROM public.sows s
      JOIN public.company_members cm ON cm.company_id = s.company_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active' AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Clients view published sow portfolio slides" ON public.sow_portfolio_slides;
CREATE POLICY "Clients view published sow portfolio slides"
  ON public.sow_portfolio_slides FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id FROM public.sows s
      JOIN public.company_members cm ON cm.company_id = s.company_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active' AND s.status = 'published'
    )
  );

NOTIFY pgrst, 'reload schema';
