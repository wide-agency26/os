-- =============================================================================
-- Process engine — modular services, costing, founder notifications
-- Migration: 20250101000020_process_scalability_costing.sql
-- =============================================================================

ALTER TABLE public.process_templates
  ADD COLUMN IF NOT EXISTS total_duration_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS template_base_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS template_kind TEXT NOT NULL DEFAULT 'package'
    CHECK (template_kind IN ('package', 'service'));

ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS suggested_expertise_role TEXT,
  ADD COLUMN IF NOT EXISTS default_unit_cost_name TEXT,
  ADD COLUMN IF NOT EXISTS default_unit_cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS default_unit_cost_is_billable BOOLEAN NOT NULL DEFAULT true;

-- Expand automation action matrix
ALTER TABLE public.step_system_automations
  DROP CONSTRAINT IF EXISTS step_system_automations_system_action_check;

ALTER TABLE public.step_system_automations
  ADD CONSTRAINT step_system_automations_system_action_check
  CHECK (system_action IN (
    'Provision_Client_Portal',
    'Lock_Production_Gating',
    'Generate_First_Invoice',
    'Notify_Founders',
    'Unlock_Portal_Tab'
  ));

-- ---- Founder notification center --------------------------------------------
CREATE TABLE IF NOT EXISTS public.founder_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  severity_level TEXT NOT NULL DEFAULT 'Info'
    CHECK (severity_level IN ('Info', 'Success', 'Warning', 'Critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_founder_notifications_unread
  ON public.founder_notifications(created_at DESC)
  WHERE is_read = false;

ALTER TABLE public.founder_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin founder_notifications" ON public.founder_notifications;
CREATE POLICY "Superadmin founder_notifications" ON public.founder_notifications
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ---- Recompute template duration + overhead -----------------------------------
CREATE OR REPLACE FUNCTION public.refresh_process_template_metrics(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.process_templates t
  SET
    total_duration_days = COALESCE((
      SELECT SUM(COALESCE(s.duration_days, 0))::INT
      FROM public.process_steps s
      WHERE s.template_id = p_template_id
    ), 0),
    template_base_cost = COALESCE((
      SELECT SUM(s.default_unit_cost_amount)
      FROM public.process_steps s
      WHERE s.template_id = p_template_id
        AND s.default_unit_cost_is_billable
        AND s.default_unit_cost_amount > 0
    ), 0),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE t.id = p_template_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_all_process_template_metrics()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.process_templates LOOP
    PERFORM public.refresh_process_template_metrics(r.id);
  END LOOP;
END;
$$;

-- ---- Seed / refresh service-level templates (14 modular blocks) ---------------
CREATE OR REPLACE FUNCTION public.seed_service_process_template(
  p_slug TEXT,
  p_name TEXT,
  p_category TEXT,
  p_description TEXT,
  p_role TEXT,
  p_cost_name TEXT,
  p_cost_amount NUMERIC,
  p_cost_recurring BOOLEAN,
  p_duration_days INT
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_template_id UUID;
  v_step_id UUID;
  v_sort INT := 0;
BEGIN
  INSERT INTO public.process_templates (slug, label, package_tier, description, version, service_slugs, template_kind)
  VALUES (p_slug, p_name, p_category, p_description, 'v1.0', ARRAY[p_slug]::TEXT[], 'service')
  ON CONFLICT (slug) DO UPDATE SET
    label = EXCLUDED.label,
    package_tier = EXCLUDED.package_tier,
    description = EXCLUDED.description,
    template_kind = 'service',
    service_slugs = EXCLUDED.service_slugs,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING id INTO v_template_id;

  DELETE FROM public.process_steps WHERE template_id = v_template_id;

  v_sort := 1;
  INSERT INTO public.process_steps (template_id, step_key, title, operational_intent, track, sort_order, is_locked, action_gate)
  VALUES (v_template_id, 'quoting_packaging', 'Quoting & Packaging Phase', 'Scope service requirements against WIDE pricing models.', 'pre_delivery', v_sort, true, 'Identified tab in /admin/work');

  v_sort := 2;
  INSERT INTO public.process_steps (template_id, step_key, title, operational_intent, track, sort_order, is_locked, action_gate)
  VALUES (v_template_id, 'proposal_sow', 'Proposal & SOW Formulation', 'Compile deliverables and milestones for this service module.', 'pre_delivery', v_sort, true, '/prospect/[prospect_id]/dashboard');

  v_sort := 3;
  INSERT INTO public.process_steps (template_id, step_key, title, operational_intent, track, sort_order, is_locked, duration_days, action_gate)
  VALUES (v_template_id, 'commercial_agreement', 'Commercial Agreement & Digital Signature', 'Legal and financial sign-off.', 'pre_delivery', v_sort, true, 5, 'Signature activates client portal')
  RETURNING id INTO v_step_id;

  DELETE FROM public.step_system_automations WHERE step_id = v_step_id;
  INSERT INTO public.step_system_automations (step_id, automation_trigger, system_action, is_active)
  VALUES (v_step_id, 'On_Step_Complete', 'Notify_Founders', true);

  v_sort := 4;
  INSERT INTO public.process_steps (
    template_id, step_key, title, operational_intent, track, sort_order, is_locked,
    phase_number, duration_days, suggested_expertise_role,
    default_unit_cost_name, default_unit_cost_amount, default_unit_cost_is_billable
  ) VALUES (
    v_template_id, 'production_' || p_slug, p_name, p_description, 'production', v_sort, false,
    1, p_duration_days, p_role, p_cost_name, p_cost_amount, true
  );

  PERFORM public.refresh_process_template_metrics(v_template_id);
  RETURN v_template_id;
END;
$$;

SELECT public.seed_service_process_template('go_to_market_strategy', 'Go-to-Market Strategy', 'Strategy', '12-month execution roadmaps aligned with business KPIs.', 'Strategy Lead', 'Market Research Subscription', 85.00, false, 21);
SELECT public.seed_service_process_template('advanced_analytics', 'Advanced Analytics', 'Strategy', 'Pipeline measurement beyond vanity metrics.', 'Data Analyst', 'Analytics Platform Seat', 120.00, true, 14);
SELECT public.seed_service_process_template('campaign_architecture', 'Campaign Architecture', 'Strategy', 'Launch and funding announcement playbooks.', 'Campaign Lead', 'Campaign Ops Toolkit', 60.00, false, 18);
SELECT public.seed_service_process_template('brand_strategy', 'Brand Strategy', 'Brand', 'Market positioning and undeniable edge.', 'Brand Strategist', 'Competitive Audit License', 45.00, false, 14);
SELECT public.seed_service_process_template('visual_identity', 'Visual Identity', 'Brand', 'Logos, typography, and visual systems.', 'Brand Designer', 'Font & Asset License Pack', 95.00, false, 21);
SELECT public.seed_service_process_template('brand_guidelines', 'Brand Guidelines', 'Brand', 'Operational consistency playbook.', 'Brand Designer', 'Guidelines Hosting', 25.00, true, 10);
SELECT public.seed_service_process_template('messaging_communications', 'Messaging & Communications', 'Brand', 'Human-first narratives for complex tech.', 'Copy Lead', 'Tone Workshop Facilitation', 0.00, false, 12);
SELECT public.seed_service_process_template('ui_ux_design', 'UI/UX Design', 'Website', 'Frictionless journeys for demos and sign-ups.', 'UI/UX Designer', 'Figma Professional Seat', 15.00, true, 21);
SELECT public.seed_service_process_template('website_development', 'Website Development', 'Website', 'SEO-first Webflow/Framer builds.', 'Webflow Developer', 'Webflow CMS Site Plan', 49.00, true, 28);
SELECT public.seed_service_process_template('seo', 'SEO', 'Growth', 'High-intent B2B SaaS search dominance.', 'SEO Specialist', 'High-Intent Keyword Indexing API', 120.00, false, 21);
SELECT public.seed_service_process_template('paid_performance', 'Paid Performance', 'Growth', 'LinkedIn, Google, and Meta acquisition.', 'Paid Media Lead', 'Ad Platform API Credits', 200.00, false, 14);
SELECT public.seed_service_process_template('crm_advocacy', 'CRM & Advocacy', 'Growth', 'Funnel optimization and sales automation.', 'CRM Architect', 'CRM Automation Connector', 75.00, true, 18);
SELECT public.seed_service_process_template('social_media_content', 'Social Media Content', 'Content', 'LinkedIn/X community growth assets.', 'Content Producer', 'Stock Media Bundle', 35.00, false, 14);
SELECT public.seed_service_process_template('video_production', 'Video Production', 'Content', 'Explainers, interviews, and product demos.', 'Video Producer', 'Render Farm Credits', 150.00, false, 21);

DROP FUNCTION IF EXISTS public.seed_service_process_template(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, INT);

-- Backfill production step costing on existing package templates
UPDATE public.process_steps ps SET
  suggested_expertise_role = v.role,
  default_unit_cost_name = v.cost_name,
  default_unit_cost_amount = v.cost_amount,
  default_unit_cost_is_billable = v.billable
FROM public.process_templates t,
LATERAL (VALUES
  ('production_brand_strategy', 'Brand Strategist', 'Competitive Audit License', 45.00, false),
  ('production_visual_identity', 'Brand Designer', 'Font & Asset License Pack', 95.00, false),
  ('production_brand_guidelines', 'Brand Designer', 'Guidelines Hosting', 25.00, true),
  ('production_ui_ux_design', 'UI/UX Designer', 'Figma Professional Seat', 15.00, true),
  ('production_website_development', 'Webflow Developer', 'Webflow CMS Site Plan', 49.00, true),
  ('production_go_to_market_strategy', 'Strategy Lead', 'Market Research Subscription', 85.00, false),
  ('production_seo', 'SEO Specialist', 'High-Intent Keyword Indexing API', 120.00, false),
  ('production_social_media_content', 'Content Producer', 'Stock Media Bundle', 35.00, false),
  ('production_advanced_analytics', 'Data Analyst', 'Analytics Platform Seat', 120.00, true),
  ('production_campaign_architecture', 'Campaign Lead', 'Campaign Ops Toolkit', 60.00, false),
  ('production_paid_performance', 'Paid Media Lead', 'Ad Platform API Credits', 200.00, false),
  ('production_video_production', 'Video Producer', 'Render Farm Credits', 150.00, false),
  ('production_messaging_communications', 'Copy Lead', 'Tone Workshop Facilitation', 0.00, false),
  ('production_crm_advocacy', 'CRM Architect', 'CRM Automation Connector', 75.00, true)
) AS v(step_key, role, cost_name, cost_amount, billable)
WHERE ps.template_id = t.id
  AND t.template_kind = 'package'
  AND ps.step_key = v.step_key;

UPDATE public.process_templates SET template_kind = 'package' WHERE template_kind IS NULL OR slug IN (
  'launch_kit', 'startup_launch', 'growth_program', 'full_partnership'
);

SELECT public.refresh_all_process_template_metrics();

GRANT EXECUTE ON FUNCTION public.refresh_process_template_metrics(UUID) TO authenticated, service_role;
