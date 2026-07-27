-- Playbook alignment: expertise roles, service/package billing models, package composition fix

ALTER TABLE public.expertise_tracks
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS linked_service_slugs TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.process_templates
  ADD COLUMN IF NOT EXISTS billing_cadence TEXT CHECK (billing_cadence IN ('one_off', 'monthly')),
  ADD COLUMN IF NOT EXISTS service_model TEXT CHECK (service_model IN ('one_off', 'hybrid', 'monthly'));

-- Deactivate legacy service-slug expertise tracks (replaced by playbook roles)
UPDATE public.expertise_tracks SET is_active = false
WHERE slug IN (
  'go_to_market_strategy', 'advanced_analytics', 'campaign_architecture',
  'brand_strategy', 'visual_identity', 'brand_guidelines', 'messaging_communications',
  'ui_ux_design', 'website_development', 'seo', 'paid_performance',
  'crm_advocacy', 'social_media_content', 'video_production'
);

INSERT INTO public.expertise_tracks (slug, label, description, sort_order, is_active, domain, linked_service_slugs)
VALUES
  ('growth_partner', 'Growth Partner', 'Lead intake, discovery, proposals, and commercial alignment with founders.', 1, true, 'Commercial', '{}'),
  ('operations_lead', 'Operations Lead', 'Agreements, invoicing, project provisioning, and handoff orchestration.', 2, true, 'Operations', '{}'),
  ('brand_strategist', 'Brand Strategist', 'Positioning, narrative, competitive research, and brand manifest sign-off.', 10, true, 'Brand', ARRAY['brand_strategy','brand_guidelines','messaging_communications','social_media_content']),
  ('ui_ux_designer', 'UI/UX Designer', 'Visual systems, wireframes, high-fidelity UI, and design-system production.', 11, true, 'Design', ARRAY['visual_identity','brand_guidelines','ui_ux_design','campaign_architecture','paid_performance','social_media_content','video_production']),
  ('webflow_developer', 'Webflow Developer', 'Webflow builds, CMS, staging QA, and technical site launch.', 12, true, 'Development', ARRAY['website_development','seo','paid_performance','crm_advocacy']),
  ('growth_strategist', 'Growth Strategist', 'GTM playbooks, funnel diagnostics, campaign architecture, and channel planning.', 20, true, 'Strategy', ARRAY['go_to_market_strategy','campaign_architecture']),
  ('analytics_engineer', 'Analytics Engineer', 'Tag audits, GA4 implementation, consent mode, and pipeline dashboards.', 21, true, 'Strategy', ARRAY['advanced_analytics','paid_performance']),
  ('seo_specialist', 'SEO Specialist', 'Commercial SEO clusters, on-page optimization, and content publishing cadence.', 30, true, 'Growth', ARRAY['seo']),
  ('paid_specialist', 'Paid Specialist', 'Paid media targeting, campaign structure, and platform launch QA.', 31, true, 'Growth', ARRAY['paid_performance']),
  ('revops_specialist', 'RevOps Specialist', 'CRM pipeline design, deal automation, and post-sale onboarding flows.', 32, true, 'Growth', ARRAY['crm_advocacy']),
  ('copywriter', 'Copywriter', 'Messaging frameworks, ad copy, social post batching, and AV scripts.', 40, true, 'Content', ARRAY['social_media_content','video_production']),
  ('content_manager', 'Content Manager', 'Publishing calendars, founder content pillars, and social scheduling.', 41, true, 'Content', ARRAY['social_media_content']),
  ('video_producer', 'Video Producer', 'Recording sessions, final cuts, and video launch sign-off.', 42, true, 'Content', ARRAY['video_production']),
  ('video_editor', 'Video Editor', 'Timeline editing, color grading, and audio balancing.', 43, true, 'Content', ARRAY['video_production'])
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  domain = EXCLUDED.domain,
  linked_service_slugs = EXCLUDED.linked_service_slugs,
  updated_at = TIMEZONE('utc'::text, NOW());

-- Migrate people tags: service slugs → playbook role slugs
UPDATE public.people p SET expertise_tags = sub.mapped
FROM (
  SELECT
    id,
    ARRAY(
      SELECT DISTINCT COALESCE(m.new_slug, tag)
      FROM unnest(COALESCE(expertise_tags, ARRAY[]::text[])) AS tag
      LEFT JOIN (VALUES
        ('go_to_market_strategy', 'growth_strategist'),
        ('advanced_analytics', 'analytics_engineer'),
        ('campaign_architecture', 'growth_strategist'),
        ('brand_strategy', 'brand_strategist'),
        ('visual_identity', 'ui_ux_designer'),
        ('brand_guidelines', 'ui_ux_designer'),
        ('messaging_communications', 'copywriter'),
        ('ui_ux_design', 'ui_ux_designer'),
        ('website_development', 'webflow_developer'),
        ('seo', 'seo_specialist'),
        ('paid_performance', 'paid_specialist'),
        ('crm_advocacy', 'revops_specialist'),
        ('social_media_content', 'content_manager'),
        ('video_production', 'video_producer')
      ) AS m(old_slug, new_slug) ON m.old_slug = tag
    ) AS mapped
  FROM public.people
) sub
WHERE p.id = sub.id;

-- Service billing models (playbook Section 3)
UPDATE public.process_templates SET service_model = v.model
FROM (VALUES
  ('brand_strategy', 'one_off'),
  ('visual_identity', 'one_off'),
  ('brand_guidelines', 'one_off'),
  ('messaging_communications', 'one_off'),
  ('ui_ux_design', 'hybrid'),
  ('website_development', 'hybrid'),
  ('go_to_market_strategy', 'hybrid'),
  ('advanced_analytics', 'hybrid'),
  ('campaign_architecture', 'one_off'),
  ('seo', 'monthly'),
  ('paid_performance', 'monthly'),
  ('social_media_content', 'monthly'),
  ('video_production', 'hybrid'),
  ('crm_advocacy', 'hybrid')
) AS v(slug, model)
WHERE process_templates.slug = v.slug AND process_templates.template_kind = 'service';

-- Package billing + MVB rename + authoritative service matrix (Section 2)
UPDATE public.process_templates SET
  label = 'The MVB',
  package_tier = 'MVB',
  billing_cadence = 'one_off',
  description = 'Minimum viable brand — brand foundation and launch-ready web presence (one-off).',
  service_slugs = ARRAY['brand_strategy','visual_identity','brand_guidelines','ui_ux_design','website_development']
WHERE slug = 'launch_kit';

UPDATE public.process_templates SET
  billing_cadence = 'monthly',
  service_slugs = ARRAY['go_to_market_strategy','ui_ux_design','website_development','seo','social_media_content']
WHERE slug = 'startup_launch';

UPDATE public.process_templates SET
  billing_cadence = 'monthly',
  service_slugs = ARRAY['go_to_market_strategy','ui_ux_design','website_development','seo','social_media_content','advanced_analytics','campaign_architecture','paid_performance','video_production']
WHERE slug = 'growth_program';

UPDATE public.process_templates SET
  billing_cadence = 'monthly',
  service_slugs = ARRAY['brand_strategy','visual_identity','brand_guidelines','messaging_communications','ui_ux_design','website_development','go_to_market_strategy','advanced_analytics','campaign_architecture','seo','paid_performance','social_media_content','video_production','crm_advocacy']
WHERE slug = 'full_partnership';

-- Packages compose from service templates at runtime — remove duplicated production steps
DELETE FROM public.process_steps
WHERE track = 'production'
  AND template_id IN (SELECT id FROM public.process_templates WHERE template_kind = 'package');

-- Remap task expertise_slug values in JSONB (service slugs → playbook roles)
CREATE OR REPLACE FUNCTION public.remap_task_expertise_slug(p_slug TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_slug
    WHEN 'go_to_market_strategy' THEN 'growth_strategist'
    WHEN 'advanced_analytics' THEN 'analytics_engineer'
    WHEN 'campaign_architecture' THEN 'growth_strategist'
    WHEN 'brand_strategy' THEN 'brand_strategist'
    WHEN 'visual_identity' THEN 'ui_ux_designer'
    WHEN 'brand_guidelines' THEN 'ui_ux_designer'
    WHEN 'messaging_communications' THEN 'copywriter'
    WHEN 'ui_ux_design' THEN 'ui_ux_designer'
    WHEN 'website_development' THEN 'webflow_developer'
    WHEN 'seo' THEN 'seo_specialist'
    WHEN 'paid_performance' THEN 'paid_specialist'
    WHEN 'crm_advocacy' THEN 'revops_specialist'
    WHEN 'social_media_content' THEN 'content_manager'
    WHEN 'video_production' THEN 'video_producer'
    ELSE p_slug
  END
$$;

UPDATE public.process_steps ps SET task_components = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem ? 'expertise_slug' THEN
        jsonb_set(elem, '{expertise_slug}', to_jsonb(public.remap_task_expertise_slug(elem->>'expertise_slug')))
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(ps.task_components) AS elem
)
WHERE jsonb_array_length(ps.task_components) > 0;

DROP FUNCTION public.remap_task_expertise_slug(TEXT);

SELECT public.refresh_all_process_template_metrics();
