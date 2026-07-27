-- =============================================================================
-- WIDE OS — Process Builder Engine (pre-delivery + production tracks)
-- Migration: 20250101000019_process_engine.sql
-- =============================================================================

-- ---- Workspace commercial / signature fields --------------------------------
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS proposal_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contract_ip_address TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_automated BOOLEAN NOT NULL DEFAULT false;

-- ---- Service catalog --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.process_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Strategy', 'Brand', 'Website', 'Growth', 'Content')),
  description TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ---- Package / template blueprints ------------------------------------------
CREATE TABLE IF NOT EXISTS public.process_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  package_tier TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT 'v1.0',
  service_slugs TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_process_templates_active ON public.process_templates(is_active) WHERE is_active;

-- ---- Template steps (immutable pre-delivery + configurable production) --------
CREATE TABLE IF NOT EXISTS public.process_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  operational_intent TEXT NOT NULL DEFAULT '',
  track TEXT NOT NULL CHECK (track IN ('pre_delivery', 'production')),
  sort_order INT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  phase_number INT,
  duration_days INT,
  task_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_gate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (template_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_process_steps_template ON public.process_steps(template_id, sort_order);

-- ---- Step automations -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.step_system_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  automation_trigger TEXT NOT NULL CHECK (automation_trigger IN ('On_Step_Activate', 'On_Step_Complete')),
  system_action TEXT NOT NULL CHECK (system_action IN (
    'Provision_Client_Portal',
    'Lock_Production_Gating',
    'Generate_First_Invoice',
    'Notify_Founders'
  )),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_step_automations_step ON public.step_system_automations(step_id);

-- ---- Signature / agreement → Active client conversion -----------------------
CREATE OR REPLACE FUNCTION public.convert_workspace_on_agreement()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    (NEW.contract_signature_name IS NOT NULL AND (OLD.contract_signature_name IS NULL OR OLD.contract_signature_name IS DISTINCT FROM NEW.contract_signature_name))
    OR (NEW.agreement_signed_at IS NOT NULL AND OLD.agreement_signed_at IS NULL)
    OR (NEW.contract_signed_at IS NOT NULL AND OLD.contract_signed_at IS NULL)
  )
  AND OLD.lifecycle_status IN ('Lead', 'Prospect') THEN
    NEW.lifecycle_status := 'Active';
    NEW.current_phase := 1;
    NEW.onboarding_automated := true;
    NEW.updated_at := TIMEZONE('utc'::text, NOW());
    IF NEW.contract_signed_at IS NULL AND NEW.agreement_signed_at IS NOT NULL THEN
      NEW.contract_signed_at := NEW.agreement_signed_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_agreement_conversion ON public.workspaces;
CREATE TRIGGER trg_workspace_agreement_conversion
  BEFORE UPDATE OF agreement_signed_at, contract_signature_name, contract_signed_at
  ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.convert_workspace_on_agreement();

-- ---- RLS (founders / superadmin configure engine) ---------------------------
ALTER TABLE public.process_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_system_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin process_services" ON public.process_services;
CREATE POLICY "Superadmin process_services" ON public.process_services
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read process_services" ON public.process_services;
CREATE POLICY "Authenticated read process_services" ON public.process_services
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin process_templates" ON public.process_templates;
CREATE POLICY "Superadmin process_templates" ON public.process_templates
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read process_templates" ON public.process_templates;
CREATE POLICY "Authenticated read process_templates" ON public.process_templates
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin process_steps" ON public.process_steps;
CREATE POLICY "Superadmin process_steps" ON public.process_steps
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read process_steps" ON public.process_steps;
CREATE POLICY "Authenticated read process_steps" ON public.process_steps
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin step_system_automations" ON public.step_system_automations;
CREATE POLICY "Superadmin step_system_automations" ON public.step_system_automations
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read step_system_automations" ON public.step_system_automations;
CREATE POLICY "Authenticated read step_system_automations" ON public.step_system_automations
  FOR SELECT USING (auth.role() = 'authenticated');

-- ---- Seed: 14 core studio services ------------------------------------------
INSERT INTO public.process_services (slug, name, category, description, sort_order) VALUES
  ('go_to_market_strategy', 'Go-to-Market Strategy', 'Strategy', 'Ruthless, 12-month execution roadmaps aligned with exact business KPIs.', 1),
  ('advanced_analytics', 'Advanced Analytics', 'Strategy', 'Custom data setups and tracking to measure actual pipeline, not just clicks.', 2),
  ('campaign_architecture', 'Campaign Architecture', 'Strategy', 'High-impact playbooks for product launches and funding announcements.', 3),
  ('brand_strategy', 'Brand Strategy', 'Brand', 'Defining the undeniable edge and market positioning.', 4),
  ('visual_identity', 'Visual Identity', 'Brand', 'Logos, typography, and visual systems that look like the future.', 5),
  ('brand_guidelines', 'Brand Guidelines', 'Brand', 'The operational playbook to maintain consistency as the startup scales.', 6),
  ('messaging_communications', 'Messaging & Communications', 'Brand', 'Translating complex tech into clear, human-first narratives.', 7),
  ('ui_ux_design', 'UI/UX Design', 'Website', 'Frictionless user journeys engineered to drive demos and sign-ups.', 8),
  ('website_development', 'Website Development', 'Website', 'Flawless, responsive, SEO-first builds on modern stacks (Webflow/Framer).', 9),
  ('seo', 'SEO', 'Growth', 'Dominating high-intent search for B2B SaaS and tech.', 10),
  ('paid_performance', 'Paid Performance', 'Growth', 'Precision-targeted acquisition on LinkedIn, Google, and Meta.', 11),
  ('crm_advocacy', 'CRM & Advocacy', 'Growth', 'Funnel optimization, plugging revenue leaks, and automating the sales flow.', 12),
  ('social_media_content', 'Social Media Content', 'Content', 'Platform-specific assets and community growth (LinkedIn/X).', 13),
  ('video_production', 'Video Production', 'Content', 'High-end explainer videos, founder interviews, and polished product demos.', 14)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- ---- Helper: insert locked pre-delivery + production steps ------------------
CREATE OR REPLACE FUNCTION public.seed_process_template(
  p_slug TEXT,
  p_label TEXT,
  p_tier TEXT,
  p_description TEXT,
  p_version TEXT,
  p_service_slugs TEXT[]
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_template_id UUID;
  v_step_id UUID;
  v_sort INT := 0;
  v_slug TEXT;
  v_name TEXT;
  v_phase INT := 0;
BEGIN
  INSERT INTO public.process_templates (slug, label, package_tier, description, version, service_slugs)
  VALUES (p_slug, p_label, p_tier, p_description, p_version, p_service_slugs)
  ON CONFLICT (slug) DO UPDATE SET
    label = EXCLUDED.label,
    package_tier = EXCLUDED.package_tier,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    service_slugs = EXCLUDED.service_slugs,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING id INTO v_template_id;

  DELETE FROM public.process_steps WHERE template_id = v_template_id;

  v_sort := v_sort + 1;
  INSERT INTO public.process_steps (template_id, step_key, title, operational_intent, track, sort_order, is_locked, action_gate)
  VALUES (
    v_template_id, 'quoting_packaging', 'Quoting & Packaging Phase',
    'Scopes core client requirements against WIDE fixed pricing models (Launch Kit, Growth Program, etc.).',
    'pre_delivery', v_sort, true, 'Connects with Identified tab in /admin/work matrix.'
  );

  v_sort := v_sort + 1;
  INSERT INTO public.process_steps (template_id, step_key, title, operational_intent, track, sort_order, is_locked, action_gate)
  VALUES (
    v_template_id, 'proposal_sow', 'Proposal & Statement of Work Formulation',
    'Compiles tailored deliverables, milestones, and project paths.',
    'pre_delivery', v_sort, true, 'Generates external path at /prospect/[prospect_id]/dashboard.'
  );

  v_sort := v_sort + 1;
  INSERT INTO public.process_steps (template_id, step_key, title, operational_intent, track, sort_order, is_locked, duration_days, action_gate)
  VALUES (
    v_template_id, 'commercial_agreement', 'Commercial Agreement & Digital Signature',
    'Legal and financial sign-off execution.',
    'pre_delivery', v_sort, true, 5,
    'On signature: lifecycle Active, client portal /client/[client_id]/dashboard, founder alert.'
  )
  RETURNING id INTO v_step_id;

  INSERT INTO public.step_system_automations (step_id, automation_trigger, system_action, is_active)
  VALUES
    (v_step_id, 'On_Step_Complete', 'Provision_Client_Portal', true),
    (v_step_id, 'On_Step_Complete', 'Notify_Founders', true);

  v_phase := 0;
  FOREACH v_slug IN ARRAY p_service_slugs LOOP
    SELECT name INTO v_name FROM public.process_services WHERE slug = v_slug;
    IF v_name IS NULL THEN
      v_name := initcap(replace(v_slug, '_', ' '));
    END IF;
    v_phase := v_phase + 1;
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked, phase_number, duration_days, task_components
    ) VALUES (
      v_template_id,
      'production_' || v_slug,
      v_name,
      'Production execution module — ' || v_name || '.',
      'production',
      v_sort,
      false,
      LEAST(v_phase, 5),
      14,
      jsonb_build_array(jsonb_build_object('type', 'deliverable_review', 'label', v_name || ' sign-off'))
    );
  END LOOP;

  RETURN v_template_id;
END;
$$;

SELECT public.seed_process_template(
  'launch_kit',
  'The Launch Kit',
  'Launch Kit',
  'Brand foundation and launch-ready web presence for early-stage startups.',
  'v1.0',
  ARRAY['brand_strategy', 'visual_identity', 'brand_guidelines', 'ui_ux_design', 'website_development']::TEXT[]
);

SELECT public.seed_process_template(
  'startup_launch',
  'The Startup Launch',
  'Startup Launch',
  'Growth-oriented launch combining brand, web, and always-on marketing engines.',
  'v1.0',
  ARRAY['go_to_market_strategy', 'ui_ux_design', 'website_development', 'seo', 'social_media_content']::TEXT[]
);

SELECT public.seed_process_template(
  'growth_program',
  'The Growth Program',
  'Growth Program',
  'Scaled delivery across web, SEO, social, paid, and analytics.',
  'v1.0',
  ARRAY[
    'go_to_market_strategy', 'ui_ux_design', 'website_development', 'seo', 'social_media_content',
    'advanced_analytics', 'campaign_architecture', 'paid_performance', 'video_production'
  ]::TEXT[]
);

SELECT public.seed_process_template(
  'full_partnership',
  'Full-Service Partnership',
  'Full Partnership',
  'Embedded WIDE operating system — full ecosystem and narrative optimization.',
  'v1.0',
  ARRAY[
    'go_to_market_strategy', 'advanced_analytics', 'campaign_architecture',
    'brand_strategy', 'visual_identity', 'brand_guidelines', 'messaging_communications',
    'ui_ux_design', 'website_development', 'seo', 'paid_performance', 'crm_advocacy',
    'social_media_content', 'video_production'
  ]::TEXT[]
);

DROP FUNCTION IF EXISTS public.seed_process_template(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);
