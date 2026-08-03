-- =============================================================================
-- WIDE Portal — Migration: CI Builder Module
-- Migration: 20260804000000_ci_builder.sql
-- =============================================================================

-- 1. Create Guidelines Table (1:1 with Project)
CREATE TABLE public.ci_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
  status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  theme JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ,
  UNIQUE(project_id)
);

ALTER TABLE public.ci_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their project's guideline"
  ON public.ci_guidelines
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to guidelines"
  ON public.ci_guidelines
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

-- Anyone can read published guidelines by slug (this will be handled server-side bypassing RLS if unauthenticated, 
-- or we can open read access to public if we want the client side to query directly). 
-- Wait, the prompt says public unauthenticated route. So we should open SELECT for published guidelines to public (anon).
CREATE POLICY "Public can view published guidelines"
  ON public.ci_guidelines
  FOR SELECT
  USING (status = 'published');


-- 2. Create Guideline Versions Table (Snapshots)
CREATE TABLE public.ci_guideline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id UUID NOT NULL REFERENCES public.ci_guidelines(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT false,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ci_guideline_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to guideline versions"
  ON public.ci_guideline_versions
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Public can view published versions"
  ON public.ci_guideline_versions
  FOR SELECT
  USING (is_published = true);


-- 3. Create Sections Table (Draft live content)
CREATE TABLE public.ci_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id UUID NOT NULL REFERENCES public.ci_guidelines(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  position INT DEFAULT 0,
  eyebrow_label TEXT,
  headline TEXT,
  headline_emphasis TEXT,
  description TEXT,
  is_visible BOOLEAN DEFAULT true,
  data JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.ci_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to sections"
  ON public.ci_sections
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));

-- Note: Clients/public don't read ci_sections directly; they read the snapshot in ci_guideline_versions.


-- 4. Create Assets Table
CREATE TABLE public.ci_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id UUID NOT NULL REFERENCES public.ci_guidelines(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.ci_sections(id) ON DELETE CASCADE,
  kind TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  label TEXT,
  caption TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ci_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to assets"
  ON public.ci_assets
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));


-- 5. Create Imports Table
CREATE TABLE public.ci_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guideline_id UUID NOT NULL REFERENCES public.ci_guidelines(id) ON DELETE CASCADE,
  manifest_json JSONB,
  uploaded_files JSONB,
  parse_report JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ci_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to imports"
  ON public.ci_imports
  FOR ALL
  USING (public.get_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'superadmin'));


-- 6. Storage Bucket for ci-assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('ci-assets', 'ci-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Read Access for CI Assets"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'ci-assets' );

CREATE POLICY "Admin Upload Access for CI Assets"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'ci-assets' AND public.get_user_role() IN ('admin', 'superadmin') );

CREATE POLICY "Admin Update Access for CI Assets"
  ON storage.objects FOR UPDATE
  USING ( bucket_id = 'ci-assets' AND public.get_user_role() IN ('admin', 'superadmin') );

CREATE POLICY "Admin Delete Access for CI Assets"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'ci-assets' AND public.get_user_role() IN ('admin', 'superadmin') );
