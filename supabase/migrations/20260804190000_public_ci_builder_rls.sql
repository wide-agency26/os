-- =============================================================================
-- WIDE Portal — Migration: Public RLS Policies for CI Builder
-- Migration: 20260804190000_public_ci_builder_rls.sql
-- =============================================================================

-- 1. Public can view project names associated with published guidelines
DROP POLICY IF EXISTS "Public can view projects with published guidelines" ON public.projects;
CREATE POLICY "Public can view projects with published guidelines"
  ON public.projects
  FOR SELECT
  TO anon, authenticated
  USING (
    id IN (
      SELECT project_id FROM public.ci_guidelines WHERE status = 'published'
    )
  );

-- 2. Ensure public can view published guidelines
DROP POLICY IF EXISTS "Public can view published guidelines" ON public.ci_guidelines;
CREATE POLICY "Public can view published guidelines"
  ON public.ci_guidelines
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- 3. Ensure public can view published guideline version snapshots
DROP POLICY IF EXISTS "Public can view published versions" ON public.ci_guideline_versions;
CREATE POLICY "Public can view published versions"
  ON public.ci_guideline_versions
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- 4. Ensure public can view assets linked to published guidelines
DROP POLICY IF EXISTS "Public can view assets of published guidelines" ON public.ci_assets;
CREATE POLICY "Public can view assets of published guidelines"
  ON public.ci_assets
  FOR SELECT
  TO anon, authenticated
  USING (
    guideline_id IN (
      SELECT id FROM public.ci_guidelines WHERE status = 'published'
    )
  );
