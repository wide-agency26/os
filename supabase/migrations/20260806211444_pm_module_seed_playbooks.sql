-- =============================================================================
-- Seed: 14 services, 4 packages, service/package playbooks (MVB detailed)
-- Idempotent via ON CONFLICT / WHERE NOT EXISTS
-- =============================================================================

-- 1. Services (exact CMS spelling — including "Messaging & Communitions")
INSERT INTO public.pm_services (name, category, sort_order) VALUES
  ('Advance Analytics', 'strategy', 1),
  ('Brand Strategy', 'brand', 2),
  ('Brand Guidelines', 'brand', 3),
  ('Visual Identity', 'brand', 4),
  ('Messaging & Communitions', 'brand', 5),
  ('Marketing Strategy', 'strategy', 6),
  ('Campaign Planning', 'strategy', 7),
  ('CRM & Advocacy', 'growth', 8),
  ('Paid Ads', 'growth', 9),
  ('SEO', 'growth', 10),
  ('Social Media Content', 'content', 11),
  ('Video Production', 'content', 12),
  ('Website Design', 'website', 13),
  ('Website Development', 'website', 14)
ON CONFLICT (name) DO NOTHING;

-- 2. Packages
INSERT INTO public.pm_packages (name, cadence_type, recurrence_unit, high_level_process, sort_order) VALUES
  (
    'MVB',
    'one_off',
    NULL,
    ARRAY[
      'Discovery & Brand Strategy',
      'Visual Identity Creation',
      'Website UI/UX Design',
      'Webflow/Framer Development & Launch'
    ],
    1
  ),
  (
    'Startup Launch',
    'recurring',
    'monthly',
    ARRAY[
      'Strategic Alignment',
      'Technical & On-Page SEO',
      'Social Content Architecture',
      'Organic Growth Execution'
    ],
    2
  ),
  (
    'Growth Program',
    'recurring',
    'monthly',
    ARRAY[
      'Advanced Data & Tracking Setup',
      'Paid Campaign Blueprints',
      'Video Production & Asset Creation',
      'Optimization & Scaling'
    ],
    3
  ),
  (
    'Full-Service Partnership',
    'recurring',
    'monthly',
    ARRAY[
      'Holistic Brand Audit',
      'Custom Strategy Architecture',
      'Full-Funnel Execution',
      'Continuous Evolution & Advocacy'
    ],
    4
  )
ON CONFLICT (name) DO NOTHING;

-- 3. Package ↔ service bundles
INSERT INTO public.pm_package_services (package_id, service_id)
SELECT p.id, s.id
FROM public.pm_packages p
CROSS JOIN public.pm_services s
WHERE p.name = 'MVB'
  AND s.name IN (
    'Brand Strategy', 'Visual Identity', 'Brand Guidelines',
    'Website Design', 'Website Development'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.pm_package_services (package_id, service_id)
SELECT p.id, s.id
FROM public.pm_packages p
CROSS JOIN public.pm_services s
WHERE p.name = 'Startup Launch'
  AND s.name IN (
    'Marketing Strategy', 'Website Design', 'Website Development',
    'SEO', 'Social Media Content'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.pm_package_services (package_id, service_id)
SELECT p.id, s.id
FROM public.pm_packages p
CROSS JOIN public.pm_services s
WHERE p.name = 'Growth Program'
  AND s.name IN (
    'Marketing Strategy', 'Website Design', 'Website Development',
    'SEO', 'Social Media Content', 'Advance Analytics',
    'Campaign Planning', 'Paid Ads', 'Video Production'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.pm_package_services (package_id, service_id)
SELECT p.id, s.id
FROM public.pm_packages p
CROSS JOIN public.pm_services s
WHERE p.name = 'Full-Service Partnership'
ON CONFLICT DO NOTHING;

-- 4. One service_playbook per service
INSERT INTO public.service_playbooks (service_id, cadence_type, recurrence_unit)
SELECT
  s.id,
  CASE
    WHEN s.name IN ('SEO', 'Social Media Content', 'Paid Ads', 'Advance Analytics', 'CRM & Advocacy')
      THEN 'recurring'
    ELSE 'one_off'
  END,
  CASE
    WHEN s.name IN ('SEO', 'Social Media Content', 'Paid Ads', 'Advance Analytics', 'CRM & Advocacy')
      THEN 'monthly'
    ELSE NULL
  END
FROM public.pm_services s
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_playbooks sp WHERE sp.service_id = s.id
);

-- 5. Task templates — helper: only insert if playbook has zero templates
-- Brand Strategy (MVB Phase 1)
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, false, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Client intake & kickoff', 'Gather stakeholders, goals, constraints, and existing assets.', 'Kickoff brief', 'Strategist', 4::numeric, false, 'Phase 1: Discovery & Definition'),
  (2, 'Storytelling workshop', 'Facilitate narrative workshop → core story pillars.', 'Workshop notes', 'Strategist', 6::numeric, false, 'Phase 1: Discovery & Definition'),
  (3, 'Brand Manifest draft', 'Synthesize positioning, promise, personality into Brand Manifest.', 'Brand Manifest v1', 'Strategist', 8::numeric, false, 'Phase 1: Discovery & Definition'),
  (4, 'Brand Manifest client review', 'Present Manifest; capture feedback and revise.', 'Approved Brand Manifest', 'Strategist', 3::numeric, true, 'Phase 1: Discovery & Definition')
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label)
WHERE s.name = 'Brand Strategy'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

-- Visual Identity (MVB Phase 2.1 + 2.2 gate)
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, false, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Visual research & moodboarding', 'Competitive + category visual research.', 'Moodboards', 'Designer', 6::numeric, false, 'Phase 2.1: Creative Process'),
  (2, 'Creative route A (Logo/Typo/Colors/Elements)', 'First of three distinct creative directions.', 'Route A presentation', 'Designer', 12::numeric, false, 'Phase 2.1: Creative Process'),
  (3, 'Creative route B (Logo/Typo/Colors/Elements)', 'Second creative direction.', 'Route B presentation', 'Designer', 12::numeric, false, 'Phase 2.1: Creative Process'),
  (4, 'Creative route C (Logo/Typo/Colors/Elements)', 'Third creative direction.', 'Route C presentation', 'Designer', 12::numeric, false, 'Phase 2.1: Creative Process'),
  (5, 'Final Route Selection / Client Sign-off', 'Client presents/selects one route. GATE — blocks Brand Guidelines, Website Design & Development.', 'Signed-off creative route', 'Strategist', 2::numeric, true, 'Phase 2.2: Alignment')
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label)
WHERE s.name = 'Visual Identity'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

-- Brand Guidelines (MVB Phase 4)
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, false, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Final brand asset production', 'Lock logo system, color, type, elements from selected route.', 'Final brand assets', 'Designer', 16::numeric, false, 'Phase 4: Brand & Web Systems'),
  (2, 'Master Figma file', 'Organize master CI file for handoff.', 'Master Figma', 'Designer', 8::numeric, false, 'Phase 4: Brand & Web Systems'),
  (3, 'Web styleguide / CI Builder publish', 'Publish brand guideline for client access.', 'Published guideline', 'Designer', 6::numeric, true, 'Phase 4: Brand & Web Systems')
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label)
WHERE s.name = 'Brand Guidelines'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

-- Website Design
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, false, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'IA & sitemap', 'Define pages and navigation.', 'Sitemap', 'Designer', 4::numeric, false, 'Website Design'),
  (2, 'Wireframes (key pages)', 'Low-fi structure for core templates.', 'Wireframes', 'Designer', 10::numeric, false, 'Website Design'),
  (3, 'UI design (desktop + mobile)', 'High-fi UI aligned to brand system.', 'UI Figma', 'Designer', 24::numeric, false, 'Website Design'),
  (4, 'Design handoff & client UI sign-off', 'Handoff specs + client approval before build.', 'Approved UI', 'Designer', 3::numeric, true, 'Website Design')
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label)
WHERE s.name = 'Website Design'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

-- Website Development (MVB Phase 5)
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, false, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Build core templates', 'Implement pages in Webflow/Framer.', 'Staging site', 'Developer', 32::numeric, false, 'Phase 5: Technical Implementation'),
  (2, 'Staging QA', 'Cross-browser, responsive, content QA.', 'QA checklist', 'Developer', 8::numeric, false, 'Phase 5: Technical Implementation'),
  (3, 'Publish & launch', 'Go-live, DNS, analytics tags.', 'Live site', 'Developer', 4::numeric, true, 'Phase 5: Technical Implementation'),
  (4, 'Post-launch optimize & monitor', 'Fix launch issues; handoff monitoring notes.', 'Handoff notes', 'Developer', 4::numeric, false, 'Phase 5: Technical Implementation')
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label)
WHERE s.name = 'Website Development'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

-- Remaining services — lean starter templates (recurring where applicable)
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, v.recurs, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Technical SEO audit (setup)', 'One-time crawl + technical baseline.', 'Audit report', 'SEO Specialist', 8::numeric, false, 'Setup', false),
  (2, 'Keyword & content plan (setup)', 'Initial keyword map and content pillars.', 'Keyword plan', 'SEO Specialist', 6::numeric, false, 'Setup', false),
  (3, 'Monthly SEO execution', 'On-page, content briefs, tracking review.', 'Monthly SEO log', 'SEO Specialist', 10::numeric, false, 'Monthly cycle', true),
  (4, 'Monthly SEO report & next actions', 'Report + prioritized next month actions.', 'SEO report', 'SEO Specialist', 3::numeric, true, 'Monthly cycle', true)
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label, recurs)
WHERE s.name = 'SEO'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, v.recurs, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Content architecture (setup)', 'Channels, pillars, cadence, voice.', 'Content architecture', 'Content Lead', 6::numeric, false, 'Setup', false),
  (2, 'Monthly content calendar', 'Plan posts for the cycle.', 'Calendar', 'Content Lead', 4::numeric, false, 'Monthly cycle', true),
  (3, 'Monthly content production', 'Create and schedule assets.', 'Published posts', 'Content Lead', 16::numeric, false, 'Monthly cycle', true),
  (4, 'Monthly performance review', 'Review engagement; adjust next cycle.', 'Social report', 'Content Lead', 2::numeric, true, 'Monthly cycle', true)
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label, recurs)
WHERE s.name = 'Social Media Content'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, v.is_gate, v.phase_label, v.recurs, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Account & tracking setup', 'Pixels, conversions, audiences baseline.', 'Tracking checklist', 'Media Buyer', 6::numeric, false, 'Setup', false),
  (2, 'Monthly campaign build/optimize', 'Launch or iterate campaigns.', 'Live campaigns', 'Media Buyer', 12::numeric, false, 'Monthly cycle', true),
  (3, 'Monthly paid report & decisions', 'CPA/ROAS review; next cycle plan.', 'Ads report', 'Media Buyer', 3::numeric, true, 'Monthly cycle', true)
) AS v(sort_order, title, description, deliverable, default_role, hours, is_gate, phase_label, recurs)
WHERE s.name = 'Paid Ads'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id, v.title, v.description, v.deliverable, v.default_role,
       v.hours, false, v.phase_label, false, v.sort_order
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
CROSS JOIN (VALUES
  (1, 'Strategy discovery', 'Goals, ICP, competitive context.', 'Discovery notes', 'Strategist', 6::numeric, 'Strategy'),
  (2, 'Marketing strategy document', 'Channels, funnel, KPIs, 90-day plan.', 'Strategy doc', 'Strategist', 12::numeric, 'Strategy'),
  (3, 'Strategy client alignment', 'Present and lock plan.', 'Approved strategy', 'Strategist', 2::numeric, 'Strategy')
) AS v(sort_order, title, description, deliverable, default_role, hours, phase_label)
WHERE s.name = 'Marketing Strategy'
  AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

-- Generic lean templates for remaining services without templates yet
INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id,
  'Define scope & kickoff',
  'Clarify deliverables and success criteria for ' || s.name || '.',
  'Scoped brief',
  'Specialist',
  4,
  false,
  s.name,
  false,
  1
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
WHERE s.name IN (
  'Advance Analytics', 'Campaign Planning', 'CRM & Advocacy',
  'Messaging & Communitions', 'Video Production'
)
AND NOT EXISTS (SELECT 1 FROM public.task_templates t WHERE t.service_playbook_id = sp.id);

INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id,
  'Execute core deliverable',
  'Produce primary output for ' || s.name || '.',
  'Primary deliverable',
  'Specialist',
  12,
  false,
  s.name,
  sp.cadence_type = 'recurring',
  2
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
WHERE s.name IN (
  'Advance Analytics', 'Campaign Planning', 'CRM & Advocacy',
  'Messaging & Communitions', 'Video Production'
)
AND (SELECT COUNT(*) FROM public.task_templates t WHERE t.service_playbook_id = sp.id) = 1;

INSERT INTO public.task_templates (
  service_playbook_id, title, description, deliverable, default_role,
  estimated_duration_hours, is_gate, phase_label, recurs, sort_order
)
SELECT sp.id,
  'Review & sign-off',
  'Client/internal review gate for ' || s.name || '.',
  'Approved deliverable',
  'Specialist',
  2,
  true,
  s.name,
  sp.cadence_type = 'recurring',
  3
FROM public.service_playbooks sp
JOIN public.pm_services s ON s.id = sp.service_id
WHERE s.name IN (
  'Advance Analytics', 'Campaign Planning', 'CRM & Advocacy',
  'Messaging & Communitions', 'Video Production'
)
AND (SELECT COUNT(*) FROM public.task_templates t WHERE t.service_playbook_id = sp.id) = 2;

-- 6. Package playbooks
INSERT INTO public.package_playbooks (package_id, cadence_type)
SELECT p.id, p.cadence_type
FROM public.pm_packages p
WHERE NOT EXISTS (
  SELECT 1 FROM public.package_playbooks pp WHERE pp.package_id = p.id
);

-- 7. MVB members (sequence groups matching process)
-- Group 0: Brand Strategy
-- Group 1: Visual Identity (gate at end)
-- Group 2: Brand Guidelines + Website Design (parallel after gate)
-- Group 3: Website Development
INSERT INTO public.package_playbook_members (
  package_playbook_id, service_playbook_id, sequence_group, parallel
)
SELECT pp.id, sp.id, v.seq, v.par
FROM public.package_playbooks pp
JOIN public.pm_packages p ON p.id = pp.package_id
JOIN public.pm_services s ON true
JOIN public.service_playbooks sp ON sp.service_id = s.id
JOIN (VALUES
  ('Brand Strategy', 0, false),
  ('Visual Identity', 1, false),
  ('Brand Guidelines', 2, true),
  ('Website Design', 2, true),
  ('Website Development', 3, false)
) AS v(svc, seq, par) ON v.svc = s.name
WHERE p.name = 'MVB'
ON CONFLICT (package_playbook_id, service_playbook_id) DO NOTHING;

-- Other packages: members from pm_package_services, sequence by sort_order
INSERT INTO public.package_playbook_members (
  package_playbook_id, service_playbook_id, sequence_group, parallel
)
SELECT pp.id, sp.id, s.sort_order, true
FROM public.package_playbooks pp
JOIN public.pm_packages p ON p.id = pp.package_id
JOIN public.pm_package_services ps ON ps.package_id = p.id
JOIN public.service_playbooks sp ON sp.service_id = ps.service_id
JOIN public.pm_services s ON s.id = ps.service_id
WHERE p.name <> 'MVB'
ON CONFLICT (package_playbook_id, service_playbook_id) DO NOTHING;

-- 8. MVB gate: Final Route Selection blocks Brand Guidelines, Website Design, Website Development
INSERT INTO public.package_playbook_gates (
  package_playbook_id, after_task_template_id, blocks_service_playbook_id
)
SELECT pp.id, tt.id, sp_block.id
FROM public.package_playbooks pp
JOIN public.pm_packages p ON p.id = pp.package_id
JOIN public.pm_services s_vi ON s_vi.name = 'Visual Identity'
JOIN public.service_playbooks sp_vi ON sp_vi.service_id = s_vi.id
JOIN public.task_templates tt
  ON tt.service_playbook_id = sp_vi.id
 AND tt.title = 'Final Route Selection / Client Sign-off'
JOIN public.pm_services s_block ON s_block.name IN (
  'Brand Guidelines', 'Website Design', 'Website Development'
)
JOIN public.service_playbooks sp_block ON sp_block.service_id = s_block.id
WHERE p.name = 'MVB'
  AND NOT EXISTS (
    SELECT 1 FROM public.package_playbook_gates g
    WHERE g.package_playbook_id = pp.id
      AND g.after_task_template_id = tt.id
      AND g.blocks_service_playbook_id = sp_block.id
  );

-- 9. Stub role rates
INSERT INTO public.pm_role_rates (role_label, hourly_rate) VALUES
  ('Strategist', 95),
  ('Designer', 85),
  ('Developer', 90),
  ('SEO Specialist', 80),
  ('Content Lead', 75),
  ('Media Buyer', 85),
  ('Specialist', 80)
ON CONFLICT (role_label) DO NOTHING;
