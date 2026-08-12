-- =============================================================================
-- SOW Builder (BD module)
-- Catalog stays on pm_services / pm_packages (playbooks). This adds:
--   - CMS copy on pm_services
--   - Client-facing deliverable templates (1 level up from task_templates)
--   - Live SOW documents tied to projects
-- =============================================================================

-- 1. Extend service catalog with CMS narrative copy (snapshotted onto SOWs)
ALTER TABLE public.pm_services
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT;

UPDATE public.pm_services SET
  short_description = v.short_description,
  description = v.description
FROM (VALUES
  ('Brand Strategy',
   'Positioning that makes the category feel smaller.',
   'We dig into goals, audience, and competitive terrain, then lock a manifesto and ICP the whole engagement can run on. No mood-board theatre — decisions that hold under pressure.'),
  ('Visual Identity',
   'Three routes. One sign-off. Then we refine.',
   'Research, moodboarding, and three distinct creative directions. Nothing downstream starts until a route is selected. Refinement is capped — clarity over endless iteration.'),
  ('Brand Guidelines',
   'The system your team can actually use.',
   'Master asset library, usage rules, and a web style guide so brand stays consistent without bottlenecking every ask through design.'),
  ('Messaging & Communitions',
   'Voice, pillars, and copy that travels.',
   'Brand voice and tone, key messaging pillars, and sample applications so every channel speaks like the same company.'),
  ('Marketing Strategy',
   'Channel priority with a real measurement spine.',
   'Roadmap, KPI framework tied to business outcomes, and a go-to-market outline when you are entering something new.'),
  ('Campaign Planning',
   'Blueprints before spend.',
   'Concept, channel/timeline plan, and creative briefs so launches, announcements, and milestones hit with intent — not improvisation.'),
  ('Advance Analytics',
   'Instrumentation before optimization.',
   'Tracking setup, a custom performance dashboard, and a baseline framework that defines what “good” looks like before we start pulling levers.'),
  ('SEO',
   'Technical foundations plus ongoing authority.',
   'Audit and on-page work up front, then monthly content and authority building so organic is a system — not a one-off cleanup.'),
  ('Paid Ads',
   'Accounts, launch, then monthly sharpening.',
   'Platform and conversion setup across LinkedIn, Google, and Meta as needed; campaign build; monthly optimization and reporting.'),
  ('CRM & Advocacy',
   'Retention and referral as designed systems.',
   'CRM/retention funnel setup, nurture sequences, and an advocacy framework so growth compounds after the first conversion.'),
  ('Social Media Content',
   'Strategy, calendar, and community — with numbers.',
   'Content pillars once, then a monthly calendar with explicit post volume and community management. Quantity is set per engagement — never left vague.'),
  ('Video Production',
   'Concept to final cuts with defined volume.',
   'Scripting, shoot days, edit, and deliverables — with shoot count and output formats specified on every SOW.'),
  ('Website Design',
   'Sitemap to hi-fi, revision-capped.',
   'UX flow, wireframes, and Webflow/Framer-ready UI. Design revisions are capped so the build can actually start.'),
  ('Website Development',
   'Build, QA, launch, short handover.',
   'Production build from approved design, staging and QA, publish, then a short post-launch window before retainer handoff if needed.')
) AS v(name, short_description, description)
WHERE public.pm_services.name = v.name;

-- 2. Default client-facing deliverable templates (per service)
CREATE TABLE IF NOT EXISTS public.sow_line_item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.pm_services(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  requires_quantity BOOLEAN NOT NULL DEFAULT false,
  quantity_placeholder TEXT,
  uses_revision_rounds BOOLEAN NOT NULL DEFAULT false,
  is_gate_note BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (service_id, title)
);

CREATE INDEX IF NOT EXISTS sow_line_item_templates_service_idx
  ON public.sow_line_item_templates (service_id, sort_order);

-- 3. SOW document
CREATE TABLE IF NOT EXISTS public.sows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'accepted', 'archived')),
  package_id UUID REFERENCES public.pm_packages(id) ON DELETE SET NULL,
  revision_rounds INT NOT NULL DEFAULT 2,
  terms_text TEXT NOT NULL,
  intro_narrative TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sows_project_id_idx ON public.sows (project_id);
CREATE INDEX IF NOT EXISTS sows_status_idx ON public.sows (status);

CREATE TABLE IF NOT EXISTS public.sow_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id UUID NOT NULL REFERENCES public.sows(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN ('strategy', 'brand', 'growth', 'content', 'website', 'custom')),
  title TEXT NOT NULL,
  portrayal TEXT NOT NULL
    CHECK (portrayal IN ('narrative', 'channel_cards', 'quantity_cadence', 'phased')),
  intro TEXT,
  service_id UUID REFERENCES public.pm_services(id) ON DELETE SET NULL,
  service_name_snapshot TEXT,
  service_description_snapshot TEXT,
  service_short_description_snapshot TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sow_sections_sow_id_idx ON public.sow_sections (sow_id, sort_order);

CREATE TABLE IF NOT EXISTS public.sow_cost_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id UUID NOT NULL REFERENCES public.sows(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Grouped scope',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sow_cost_groups_sow_id_idx ON public.sow_cost_groups (sow_id);

CREATE TABLE IF NOT EXISTS public.sow_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id UUID NOT NULL REFERENCES public.sows(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sow_sections(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.pm_services(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.sow_line_item_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  price NUMERIC(12,2),
  original_price NUMERIC(12,2),
  cost_group_id UUID REFERENCES public.sow_cost_groups(id) ON DELETE SET NULL,
  quantity_label TEXT,
  requires_quantity BOOLEAN NOT NULL DEFAULT false,
  cadence TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  uses_revision_rounds BOOLEAN NOT NULL DEFAULT false,
  is_gate_note BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sow_line_items_section_idx ON public.sow_line_items (section_id, sort_order);
CREATE INDEX IF NOT EXISTS sow_line_items_sow_idx ON public.sow_line_items (sow_id);
CREATE INDEX IF NOT EXISTS sow_line_items_cost_group_idx ON public.sow_line_items (cost_group_id);

CREATE TABLE IF NOT EXISTS public.sow_portfolio_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id UUID NOT NULL REFERENCES public.sows(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  candidate_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  category_tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sow_portfolio_slides_sow_idx
  ON public.sow_portfolio_slides (sow_id, sort_order);

-- 4. Seed deliverable templates from MVB process + gap-filled package steps
-- Helper: insert templates for a service by name
DO $$
DECLARE
  sid UUID;
BEGIN
  -- Brand Strategy
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Brand Strategy';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Discovery Workshop', 'Structured intake session to align on business goals, audience, and competitive landscape.', 1),
      (sid, 'Market & Competitor Positioning Review', NULL, 2),
      (sid, 'Brand Manifesto', 'Mission, vision, values, and positioning statement.', 3),
      (sid, 'Target Audience Definition (ICP)', NULL, 4)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Visual Identity
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Visual Identity';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (
      service_id, title, description, uses_revision_rounds, is_gate_note, sort_order
    ) VALUES
      (sid, 'Visual Research & Moodboarding', NULL, false, false, 1),
      (sid, '3 Creative Direction Routes', 'Logo concept, typography, color palette, and visual elements per route.', false, false, 2),
      (sid, 'Route Selection & Sign-Off', 'Nothing downstream starts until one route is selected.', false, true, 3),
      (sid, 'Refinement of Selected Route', 'Revisions included per the SOW revision rounds default.', true, false, 4),
      (sid, 'Final Logo Suite', 'Primary/secondary marks, icon, delivered in standard file formats.', false, false, 5)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Brand Guidelines
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Brand Guidelines';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Master Brand Asset Library', 'Organized Figma file with all approved logo, color, and type assets.', 1),
      (sid, 'Brand Guideline Document', 'Usage rules and do''s/don''ts for internal and external use.', 2),
      (sid, 'Web Style Guide', 'Component-level design rules for digital application.', 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Messaging & Communitions (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Messaging & Communitions';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Brand Voice & Tone Definition', NULL, 1),
      (sid, 'Key Messaging Pillars', 'The core talk tracks used across channels.', 2),
      (sid, 'Sample Copy Applications', 'Tagline options, elevator pitch, hero copy for reference use.', 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Marketing Strategy (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Marketing Strategy';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Marketing Roadmap', 'Channel prioritization and phased timeline.', 1),
      (sid, 'KPI & Goal Framework', 'Tied to actual business objectives, not vanity metrics.', 2),
      (sid, 'Go-to-Market Outline', 'For a new market entry or launch, where applicable.', 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Campaign Planning (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Campaign Planning';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Campaign Concept & Blueprint', 'Per launch, announcement, or funding milestone.', 1),
      (sid, 'Channel & Timeline Plan', NULL, 2),
      (sid, 'Creative Brief', 'Direction handed to the team producing campaign assets.', 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Advance Analytics (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Advance Analytics';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Tracking & Analytics Setup', 'GA4/GTM (or equivalent) implementation.', 1),
      (sid, 'Custom Performance Dashboard', NULL, 2),
      (sid, 'Baseline Reporting Framework', 'Defines what “good” looks like before optimization starts.', 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- SEO
  SELECT id INTO sid FROM public.pm_services WHERE name = 'SEO';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (
      service_id, title, description, is_recurring, sort_order
    ) VALUES
      (sid, 'Technical SEO Audit', 'One-time, at engagement start.', false, 1),
      (sid, 'On-Page Optimization', 'Content, meta, and site structure.', false, 2),
      (sid, 'Ongoing Content & Authority Building', 'Recurring monthly.', true, 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Paid Ads (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Paid Ads';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (
      service_id, title, description, is_recurring, sort_order
    ) VALUES
      (sid, 'Platform Setup', 'Ad accounts, pixel/conversion tracking across LinkedIn, Google, Meta as applicable.', false, 1),
      (sid, 'Campaign Build & Launch', 'Per platform.', false, 2),
      (sid, 'Monthly Optimization & Reporting', 'Recurring monthly.', true, 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- CRM & Advocacy (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'CRM & Advocacy';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'CRM / Retention Funnel Setup', NULL, 1),
      (sid, 'Automated Nurture Sequences', 'Lifecycle email or equivalent.', 2),
      (sid, 'Advocacy/Referral Program Framework', NULL, 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Social Media Content
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Social Media Content';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (
      service_id, title, description, is_recurring, requires_quantity, quantity_placeholder, sort_order
    ) VALUES
      (sid, 'Content Strategy & Pillars', 'One-time, at engagement start.', false, false, NULL, 1),
      (sid, 'Monthly Content Calendar', 'Admin must set post quantity per SOW.', true, true, 'e.g. 8 posts/month', 2),
      (sid, 'Community Management', 'Recurring monthly, LinkedIn/X as applicable.', true, false, NULL, 3)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Video Production (gap-filled)
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Video Production';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (
      service_id, title, description, requires_quantity, quantity_placeholder, sort_order
    ) VALUES
      (sid, 'Concept & Scripting', NULL, false, NULL, 1),
      (sid, 'Production Day(s)', 'Number of shoot days — required per SOW.', true, 'e.g. 2 shoot days', 2),
      (sid, 'Editing & Post-Production', NULL, false, NULL, 3),
      (sid, 'Final Deliverables', 'Format/count — required per SOW.', true, 'e.g. 1 founder explainer + 3 product demos', 4)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Website Design
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Website Design';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (
      service_id, title, description, uses_revision_rounds, sort_order
    ) VALUES
      (sid, 'Sitemap & UX Flow', NULL, false, 1),
      (sid, 'Wireframes', 'Key pages.', false, 2),
      (sid, 'High-Fidelity UI Design', 'Per page, built Webflow/Framer-ready.', false, 3),
      (sid, 'Design Revisions', 'Revision rounds included per the SOW default.', true, 4)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;

  -- Website Development
  SELECT id INTO sid FROM public.pm_services WHERE name = 'Website Development';
  IF sid IS NOT NULL THEN
    INSERT INTO public.sow_line_item_templates (service_id, title, description, sort_order) VALUES
      (sid, 'Webflow/Framer Build', 'From approved design.', 1),
      (sid, 'Staging & QA', NULL, 2),
      (sid, 'Publish & Launch', NULL, 3),
      (sid, 'Post-Launch Monitoring & Handover', 'Short window, then transitions to a retainer if applicable.', 4)
    ON CONFLICT (service_id, title) DO NOTHING;
  END IF;
END $$;

-- 5. RLS
ALTER TABLE public.sow_line_item_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sow_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sow_cost_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sow_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sow_portfolio_slides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.sow_line_item_templates TO authenticated;
GRANT ALL ON public.sows TO authenticated;
GRANT ALL ON public.sow_sections TO authenticated;
GRANT ALL ON public.sow_cost_groups TO authenticated;
GRANT ALL ON public.sow_line_items TO authenticated;
GRANT ALL ON public.sow_portfolio_slides TO authenticated;

DROP POLICY IF EXISTS "Staff manage sow line item templates" ON public.sow_line_item_templates;
CREATE POLICY "Staff manage sow line item templates"
  ON public.sow_line_item_templates
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Staff manage sows" ON public.sows;
CREATE POLICY "Staff manage sows"
  ON public.sows
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Clients view published sows" ON public.sows;
CREATE POLICY "Clients view published sows"
  ON public.sows
  FOR SELECT TO authenticated
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

DROP POLICY IF EXISTS "Staff manage sow sections" ON public.sow_sections;
CREATE POLICY "Staff manage sow sections"
  ON public.sow_sections
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Clients view published sow sections" ON public.sow_sections;
CREATE POLICY "Clients view published sow sections"
  ON public.sow_sections
  FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT id FROM public.sows WHERE status = 'published'
    )
    AND sow_id IN (
      SELECT s.id
      FROM public.sows s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Staff manage sow cost groups" ON public.sow_cost_groups;
CREATE POLICY "Staff manage sow cost groups"
  ON public.sow_cost_groups
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Clients view published sow cost groups" ON public.sow_cost_groups;
CREATE POLICY "Clients view published sow cost groups"
  ON public.sow_cost_groups
  FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id
      FROM public.sows s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Staff manage sow line items" ON public.sow_line_items;
CREATE POLICY "Staff manage sow line items"
  ON public.sow_line_items
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Clients view published sow line items" ON public.sow_line_items;
CREATE POLICY "Clients view published sow line items"
  ON public.sow_line_items
  FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id
      FROM public.sows s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND s.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Staff manage sow portfolio slides" ON public.sow_portfolio_slides;
CREATE POLICY "Staff manage sow portfolio slides"
  ON public.sow_portfolio_slides
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Clients view published sow portfolio slides" ON public.sow_portfolio_slides;
CREATE POLICY "Clients view published sow portfolio slides"
  ON public.sow_portfolio_slides
  FOR SELECT TO authenticated
  USING (
    sow_id IN (
      SELECT s.id
      FROM public.sows s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.company_members cm ON cm.company_id = p.client_id
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND s.status = 'published'
    )
  );

NOTIFY pgrst, 'reload schema';
