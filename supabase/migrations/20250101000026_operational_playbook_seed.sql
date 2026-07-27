-- Operational playbook seed: phases, tasks, resources (generated from lib/process/playbook/)
-- Summary: {"preDeliveryPhases":3,"preDeliveryTasks":12,"services":14,"servicePhases":29,"serviceTasks":92,"totalTasks":104,"byService":{"brand_strategy":8,"visual_identity":9,"brand_guidelines":7,"messaging_communications":6,"ui_ux_design":8,"website_development":8,"go_to_market_strategy":6,"advanced_analytics":6,"campaign_architecture":6,"seo":4,"paid_performance":6,"social_media_content":6,"video_production":6,"crm_advocacy":6}}

INSERT INTO public.resources (resource_name, resource_type, billing_type, cost_amount, access_link)
VALUES
  ('Google Workspace', 'Tool', 'Fixed_Monthly', 12, 'https://workspace.google.com'),
  ('Adobe Creative Cloud', 'Tool', 'Fixed_Monthly', 54.99, 'https://adobe.com'),
  ('Cursor', 'Tool', 'Fixed_Monthly', 20, 'https://cursor.com'),
  ('Google Search Console', 'Tool', 'Fixed_Monthly', 0, 'https://search.google.com/search-console'),
  ('Google Ads', 'Other_Resource', 'Per_Project_Pass_Through', 0, NULL),
  ('Meta Ads', 'Other_Resource', 'Per_Project_Pass_Through', 0, NULL),
  ('LinkedIn Ads', 'Other_Resource', 'Per_Project_Pass_Through', 0, NULL),
  ('Vercel', 'Tool', 'Fixed_Monthly', 20, 'https://vercel.com'),
  ('Supabase', 'Tool', 'Fixed_Monthly', 25, 'https://supabase.com')
ON CONFLICT (resource_name) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  billing_type = EXCLUDED.billing_type,
  cost_amount = EXCLUDED.cost_amount,
  access_link = COALESCE(EXCLUDED.access_link, public.resources.access_link);

INSERT INTO public.expertise_tracks (slug, label, description, sort_order, is_active)
VALUES ('operations_lead', 'Operations Lead', 'Commercial ops, agreements, and handoff.', 99, true)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.playbook_resource_id(p_name TEXT)
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT id FROM public.resources WHERE resource_name = p_name LIMIT 1
 $$;

CREATE OR REPLACE FUNCTION public.playbook_task_components_with_resources(p_tasks JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_out JSONB := '[]'::jsonb;
  v_task JSONB;
  v_res UUID;
BEGIN
  FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
  LOOP
    v_res := NULL;
    IF v_task ? 'resource_name' THEN
      v_res := public.playbook_resource_id(v_task->>'resource_name');
      v_task := v_task - 'resource_name';
    END IF;
    IF v_res IS NOT NULL THEN
      v_task := v_task || jsonb_build_object('linked_resource_id', v_res::text);
    END IF;
    v_out := v_out || jsonb_build_array(v_task);
  END LOOP;
  RETURN v_out;
END;
 $$;

CREATE OR REPLACE FUNCTION public.apply_playbook_pre_delivery(p_template_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.process_steps SET
    title = 'Phase 0.1: Lead Info & Alignment',
    duration_days = 4,
    duration_hours = 3.5,
    task_components = public.playbook_task_components_with_resources('[{"id":"playbook-L0-1-1","type":"Deliverable","label":"Dispatch standardized digital Intake Questionnaire to collect baseline business data.3","required":true,"duration_days":1,"duration_hours":0.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-L0-1-2","type":"Internal Milestone","label":"Review questionnaire answers to extract core value drivers and funding rounds.2","required":false,"duration_days":1,"duration_hours":1,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-L0-1-3","type":"Internal Milestone","label":"Audit lead''s current website and brand presence against competitors to locate GTM gaps.3","required":false,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-L0-1-4","type":"Deliverable","label":"Facilitate a 30-minute diagnostic discovery call to validate problem-solution fit.2","required":true,"duration_days":1,"duration_hours":0.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
  WHERE template_id = p_template_id AND step_key = 'quoting_packaging';
  UPDATE public.process_steps SET
    title = 'Phase 0.2: Proposal & Quotation',
    duration_days = 4,
    duration_hours = 7,
    task_components = public.playbook_task_components_with_resources('[{"id":"playbook-P0-2-1","type":"Internal Milestone","label":"Scope required services and map them against one of our 4 core packages.1","required":false,"duration_days":1,"duration_hours":1.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-P0-2-2","type":"Internal Milestone","label":"Build high-end, tailored strategic proposal slides outlining scope and timeline.2","required":false,"duration_days":1,"duration_hours":3.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-P0-2-3","type":"Deliverable","label":"Conduct proposal pitch call with founders to walk through scope and pricing tiers.2","required":true,"duration_days":1,"duration_hours":1,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-P0-2-4","type":"Deliverable","label":"Refine proposal scope and adjust commercial pricing variables based on feedback.6","required":true,"duration_days":1,"duration_hours":1,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
  WHERE template_id = p_template_id AND step_key = 'proposal_sow';
  UPDATE public.process_steps SET
    title = 'Phase 0.3: Agreement & Onboarding',
    duration_days = 4,
    duration_hours = 4,
    task_components = public.playbook_task_components_with_resources('[{"id":"playbook-A0-3-1","type":"Internal Milestone","label":"Generate standard legal Master Services Agreement (MSA) and customized Scope of Work (SOW).2","required":false,"duration_days":1,"duration_hours":1.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-A0-3-2","type":"Deliverable","label":"Review contract clauses and execute digital signature with the client.2","required":true,"duration_days":1,"duration_hours":1,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-A0-3-3","type":"Deliverable","label":"Issue deposit invoice (50% upfront for one-offs, or Month 1 retainer in advance).5","required":true,"duration_days":1,"duration_hours":0.5,"expertise_slug":"operations_lead","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-A0-3-4","type":"Internal Milestone","label":"Provision project directory, shared asset folders, and schedule kickoff session.2","required":false,"duration_days":1,"duration_hours":1,"expertise_slug":"operations_lead","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
  WHERE template_id = p_template_id AND step_key = 'commercial_agreement';
END;
 $$;

CREATE OR REPLACE FUNCTION public.apply_playbook_service_production(p_template_id UUID, p_slug TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_sort INT;
BEGIN
  DELETE FROM public.process_steps WHERE template_id = p_template_id AND track = 'production';
  SELECT COALESCE(MAX(sort_order), 3) INTO v_sort FROM public.process_steps WHERE template_id = p_template_id AND track = 'pre_delivery';
  v_sort := v_sort + 1;
  IF p_slug = 'brand_strategy' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_brand_strategy_p1', 'Phase 1: Discovery & Research',
      'Phase 1: Discovery & Research', 'production', v_sort, false,
      1, 4, 10.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BS-1-1","type":"Internal Milestone","label":"Clean and organize all qualitative data from Client Intake Questionnaire.3","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-1-2","type":"Internal Milestone","label":"Research direct and indirect competitors'' market positioning and visual strategies.3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-1-3","type":"Internal Milestone","label":"Synthesize competitor positioning vectors into visual comparison slides.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BS-1-4","type":"Deliverable","label":"Present competitor findings to lock down the target strategic positioning \"white space\".3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_brand_strategy_p2', 'Phase 2: Positioning & Storytelling',
      'Phase 2: Positioning & Storytelling', 'production', v_sort, false,
      2, 4, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BS-2-1","type":"Internal Milestone","label":"Draft core brand promise, vision statements, corporate mission, and supporting values.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-2","type":"Internal Milestone","label":"Write the 1-page Story Narrative and Brand Manifest (the core project North Star).3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-3","type":"Internal Milestone","label":"Compile workshop findings and narratives into the final Analysis Summary document.3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-4","type":"Deliverable","label":"Present final positioning and secure client sign-off on the Brand Manifest.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'visual_identity' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_visual_identity_p1', 'Phase 1: Creative Exploration',
      'Phase 1: Creative Exploration', 'production', v_sort, false,
      1, 2, 7.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-1-1","type":"Internal Milestone","label":"Collect visual references, textures, color moods, and typography ideas in Figma.3","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-1-2","type":"Deliverable","label":"Run a visual mood board call with the client to lock in high-level art direction preferences.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_visual_identity_p2', 'Phase 2: Route Development',
      'Phase 2: Route Development', 'production', v_sort, false,
      2, 6, 30,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-2-1","type":"Internal Milestone","label":"Develop Route 1: The Safe Scaler (High Logic / High Execution) logo and color concepts.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-2-2","type":"Internal Milestone","label":"Develop Route 2: The Market Disruptor (High Creative / High Tone) visual concept patterns.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-2-3","type":"Internal Milestone","label":"Develop Route 3: The Balanced Authority (Medium All) visual system pairings.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_visual_identity_p3', 'Phase 3: Presentation & Alignment',
      'Phase 3: Presentation & Alignment', 'production', v_sort, false,
      3, 4, 12,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-3-1","type":"Internal Milestone","label":"Build objective LTCE Scorecards for all three visual routes based on business fit.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-2","type":"Deliverable","label":"Present the three visual routes, using the LTCE scorecards to guide client choice.3","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-3","type":"Deliverable","label":"Incorporate visual feedback to refine the winning route''s primary mark and assets.3","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-4","type":"Deliverable","label":"Secure formal client signature and sign-off on the final visual system lockup.3","required":true,"duration_days":1,"duration_hours":1,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'brand_guidelines' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_brand_guidelines_p1', 'Phase 1: Asset Export',
      'Phase 1: Asset Export', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BG-1-1","type":"Internal Milestone","label":"Export the final approved logo files across formats (SVG, PNG, EPS) into organized folders.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-1-2","type":"Internal Milestone","label":"Structure shared Google Drive directories to compile all production assets.3","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_brand_guidelines_p2', 'Phase 2: Guidelines Creation',
      'Phase 2: Guidelines Creation', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BG-2-1","type":"Internal Milestone","label":"Document precise safe zones, clear-space minimums, scale bounds, and improper usage rules.3","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-2","type":"Internal Milestone","label":"Map primary, secondary, and extended brand color tokens for print and digital setups.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-3","type":"Internal Milestone","label":"Document verbal voice standards, corporate adjectives, vocabulary rules, and copy templates.1","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BG-2-4","type":"Internal Milestone","label":"Compile visual and verbal rules into the complete Master Brand Guidelines book.3","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-5","type":"Deliverable","label":"Deliver finalized guidelines book and folder access links to the client for sign-off.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'messaging_communications' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_messaging_communications_p1', 'Phase 1: Persona Formulation',
      'Phase 1: Persona Formulation', 'production', v_sort, false,
      1, 2, 7.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-MC-1-1","type":"Internal Milestone","label":"Document 2-3 target customer personas (business KPIs, pain points, tool stacks, objections).9","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-1-2","type":"Deliverable","label":"Lead persona review call with sales/marketing stakeholders to validate real-world accuracy.10","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_messaging_communications_p2', 'Phase 2: Architecture & Copy Guides',
      'Phase 2: Architecture & Copy Guides', 'production', v_sort, false,
      2, 4, 18.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-MC-2-1","type":"Internal Milestone","label":"Draft core promise, secondary value pillars, and software feature-to-benefit matrices.9","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-2-2","type":"Internal Milestone","label":"Write conversational tags, company elevator pitches, and cold sales email scripts.1","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-2-3","type":"Internal Milestone","label":"Format positioning guides and messaging templates into a clean copy framework sheet.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-2-4","type":"Deliverable","label":"Review copy frameworks with executive team and secure final messaging sign-off.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'ui_ux_design' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_ui_ux_design_p1', 'Phase 1: Information Architecture',
      'Phase 1: Information Architecture', 'production', v_sort, false,
      1, 3, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-1-1","type":"Deliverable","label":"Map website sitemap structures and user flow pages in Figma.8","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-2","type":"Internal Milestone","label":"Design low-fidelity wireframes detailing page structure and content placement.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-3","type":"Deliverable","label":"Run low-fidelity wireframe walkthrough to approve layouts and copy hierarchy.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_ui_ux_design_p2', 'Phase 2: High-Fi UI & Design Systems',
      'Phase 2: High-Fi UI & Design Systems', 'production', v_sort, false,
      2, 7, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-2-1","type":"Internal Milestone","label":"Configure global Figma variables (primary colors, font scale tokens, padding values).11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-2","type":"Internal Milestone","label":"Convert wireframes into desktop and mobile mockups using Auto Layout.11","required":false,"duration_days":3,"duration_hours":18,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-3","type":"Internal Milestone","label":"Design interactive components (button hovers, active input states, form success screens).11","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-4","type":"Deliverable","label":"Build click-through prototype flows in Figma to preview responsive user journeys.12","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-5","type":"Deliverable","label":"Walk through high-fidelity designs with client to secure layout sign-off.12","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'website_development' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_website_development_p1', 'Phase 1: Variables Setup',
      'Phase 1: Variables Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-1-1","type":"Internal Milestone","label":"Clone standard style guides (Client-First / Relume) into the new Webflow workspace.11","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-1-2","type":"Internal Milestone","label":"Connect Figma variables and sync styles (color, typography) to Webflow using the plugin.14","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"website_development","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_website_development_p2', 'Phase 2: Production Build',
      'Phase 2: Production Build', 'production', v_sort, false,
      2, 5, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-2-1","type":"Internal Milestone","label":"Code section containers, navigation menus, and grid layouts via clean CSS Flexbox.11","required":false,"duration_days":3,"duration_hours":22,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-2","type":"Internal Milestone","label":"Configure CMS collection fields and category mapping for dynamic data models.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-3","type":"Internal Milestone","label":"Program custom hover states, scroll triggers, and native page transition animations.13","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_website_development_p3', 'Phase 3: Staging, QA & Launch',
      'Phase 3: Staging, QA & Launch', 'production', v_sort, false,
      3, 3, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-3-1","type":"Deliverable","label":"Deploy to staging URLs for multi-device QA checks and layout responsiveness.8","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-3-2","type":"Internal Milestone","label":"Embed SVG custom code, map 301 redirects, compress media, and audit sitemaps.11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-WV-3-3","type":"Deliverable","label":"Link live custom domains, configure DNS target values, and publish live.8","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'go_to_market_strategy' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_go_to_market_strategy_p1', 'Phase 1: Funnel Diagnostic',
      'Phase 1: Funnel Diagnostic', 'production', v_sort, false,
      1, 2, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-1-1","type":"Internal Milestone","label":"Audit client''s historical site traffic, conversions, active ad spend, and CAC models.17","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-1-2","type":"Internal Milestone","label":"Run competitor research mapping search authority, keyword gaps, and active paid ad strategies.19","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_go_to_market_strategy_p2', 'Phase 2: GTM Playbook',
      'Phase 2: GTM Playbook', 'production', v_sort, false,
      2, 4, 18,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-2-1","type":"Internal Milestone","label":"Model core unit economics (SaaS LTV targets, payback periods, CAC ceilings).9","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-2","type":"Deliverable","label":"Define pipeline target metrics (SQL velocity, Monthly Booked Demos, conversion rates).7","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-3","type":"Internal Milestone","label":"Map budget split channels across organic (SEO, brand) and active paid systems.19","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-4","type":"Deliverable","label":"Draft 12-Month GTM Playbook and conduct alignment walk-through with leadership.1","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'advanced_analytics' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_advanced_analytics_p1', 'Phase 1: Tag Audit',
      'Phase 1: Tag Audit', 'production', v_sort, false,
      1, 2, 8,
      public.playbook_task_components_with_resources('[{"id":"playbook-AA-1-1","type":"Internal Milestone","label":"Run technical scripts audit on live pages to catalog tracking scripts and pixel triggers.23","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"advanced_analytics","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-AA-1-2","type":"Deliverable","label":"Draft event taxonomy tracking plan specifying lower-case event names and variables.24","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"advanced_analytics","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_advanced_analytics_p2', 'Phase 2: Implementation',
      'Phase 2: Implementation', 'production', v_sort, false,
      2, 4, 25,
      public.playbook_task_components_with_resources('[{"id":"playbook-AA-2-1","type":"Internal Milestone","label":"Configure custom GA4 event tags (e.g., demo click, pricing view, video completion).7","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0},{"id":"playbook-AA-2-2","type":"Internal Milestone","label":"Inject JS tracking scripts inside Cursor to trigger signup and transaction indicators.23","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Cursor","cost_buffer_percent":0},{"id":"playbook-AA-2-3","type":"Deliverable","label":"Install consent banner controls and configure Google Consent Mode v2 parameters.21","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"advanced_analytics","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-AA-2-4","type":"Deliverable","label":"Build reporting dashboard connecting traffic, ad-platform attribution, and conversions.7","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'campaign_architecture' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_campaign_architecture_p1', 'Phase 1: Creative Concept',
      'Phase 1: Creative Concept', 'production', v_sort, false,
      1, 2, 9,
      public.playbook_task_components_with_resources('[{"id":"playbook-CP-1-1","type":"Deliverable","label":"Define campaign business targets, audience focus, and write Campaign Creative Brief.12","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-1-2","type":"Internal Milestone","label":"Design visual campaign styles, layout concept boards, and messaging directions.27","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_campaign_architecture_p2', 'Phase 2: Asset Schedule',
      'Phase 2: Asset Schedule', 'production', v_sort, false,
      2, 4, 16.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-CP-2-1","type":"Deliverable","label":"Build campaign checklist (landing page specs, ad copy assets, outbound tracking).28","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-2","type":"Internal Milestone","label":"Draft ad headline variations, promo copy, email templates, and community shares.12","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-3","type":"Internal Milestone","label":"Map day-by-day launch pipeline tasks, tracking owners, and publish dates.12","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-4","type":"Deliverable","label":"Conduct pre-launch review with client stakeholders and authorize campaign launch.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'seo' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_seo_p1', 'Phase 1: On-Page Optimization',
      'Phase 1: On-Page Optimization', 'production', v_sort, false,
      1, 4, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SE-1-1","type":"Internal Milestone","label":"Identify high-intent competitor terms and map commercial bottom-of-funnel content clusters.28","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"seo","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-2","type":"Internal Milestone","label":"Run site health crawl to diagnose GSC page indexing problems, missing tags, and sitemap errors.8","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-3","type":"Internal Milestone","label":"Draft targeted meta titles, description tags, and headers to secure search visibility.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"seo","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SE-1-4","type":"Deliverable","label":"Review monthly content calendar, apply revisions, and publish optimized pages.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"seo","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'paid_performance' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_paid_performance_p1', 'Phase 1: Targeting Setup',
      'Phase 1: Targeting Setup', 'production', v_sort, false,
      1, 2, 9,
      public.playbook_task_components_with_resources('[{"id":"playbook-PA-1-1","type":"Deliverable","label":"Set up platform audience parameters, upload account lists, and apply seniority exclusions.4","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"paid_performance","resource_name":"Google Ads","cost_buffer_percent":0},{"id":"playbook-PA-1-2","type":"Internal Milestone","label":"Structure campaign architecture matching budgets to Creation, Harvesting, and Conversion.4","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"paid_performance","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_paid_performance_p2', 'Phase 2: Creative & Launch',
      'Phase 2: Creative & Launch', 'production', v_sort, false,
      2, 6, 31,
      public.playbook_task_components_with_resources('[{"id":"playbook-PA-2-1","type":"Internal Milestone","label":"Write conversion ad copies and design visual creatives (Thought Leaders, multi-page PDFs).4","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-PA-2-2","type":"Internal Milestone","label":"Build dedicated, fast high-conversion landing pages to receive campaign traffic.12","required":false,"duration_days":2,"duration_hours":12,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-PA-2-3","type":"Internal Milestone","label":"Map platform conversion triggers and integrate server-side tracking loops.4","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0},{"id":"playbook-PA-2-4","type":"Deliverable","label":"Verify tracking triggers in platform preview states and push ad campaigns live.21","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"paid_performance","resource_name":"Google Ads","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'social_media_content' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_social_media_content_p1', 'Phase 1: Content Setup',
      'Phase 1: Content Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-1-1","type":"Deliverable","label":"Map founder''s core pillars (Insights, Story lessons, Client wins) to business objectives.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-1-2","type":"Deliverable","label":"Build monthly publishing calendar containing target post dates and selected formats.34","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_social_media_content_p2', 'Phase 2: Drafting & Styling',
      'Phase 2: Drafting & Styling', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-2-1","type":"Internal Milestone","label":"Batch-write punchy text posts focusing on strong hooks, clear formatting, and value.34","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-2","type":"Internal Milestone","label":"Design custom post images and multi-page carousels to elevate visual scroll-stopping.34","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-SM-2-3","type":"Deliverable","label":"Present monthly drafts, capture founder revisions, and refine hooks.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-4","type":"Deliverable","label":"Schedule approved monthly posts directly within native/platform scheduling systems.34","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'video_production' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_video_production_p1', 'Phase 1: Pre-Production',
      'Phase 1: Pre-Production', 'production', v_sort, false,
      1, 2, 14,
      public.playbook_task_components_with_resources('[{"id":"playbook-VP-1-1","type":"Deliverable","label":"Write dual-column AV scripts mapping scene dialogue to visual graphic instructions.27","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-VP-1-2","type":"Deliverable","label":"Design storyboards in Figma to pre-visualize lighting angles, frames, and overlays.35","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_video_production_p2', 'Phase 2: Shooting & Post',
      'Phase 2: Shooting & Post', 'production', v_sort, false,
      2, 5, 26,
      public.playbook_task_components_with_resources('[{"id":"playbook-VP-2-1","type":"Deliverable","label":"Configure camera gear, test high-fidelity audio equipment, and run recording sessions.27","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"video_production","resource_name":"Adobe Creative Cloud","cost_buffer_percent":0},{"id":"playbook-VP-2-2","type":"Internal Milestone","label":"Edit footage timeline sequences, run color grading, and balance audio mixes.29","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"video_production","resource_name":"Adobe Creative Cloud","cost_buffer_percent":0},{"id":"playbook-VP-2-3","type":"Internal Milestone","label":"Design matching overlay graphics, dynamic typography, and title frames in Figma.35","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VP-2-4","type":"Deliverable","label":"Deliver final polished draft cuts to the client and secure video launch sign-off.27","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"video_production","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  ELSIF p_slug = 'crm_advocacy' THEN
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_crm_advocacy_p1', 'Phase 1: Pipeline Architecture',
      'Phase 1: Pipeline Architecture', 'production', v_sort, false,
      1, 2, 10,
      public.playbook_task_components_with_resources('[{"id":"playbook-CR-1-1","type":"Deliverable","label":"Audit internal lead-handling steps, manual handovers, and customer bottlenecks.10","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"crm_advocacy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CR-1-2","type":"Internal Milestone","label":"Design custom deal properties, pipeline stages, and onboarding checklists.37","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      p_template_id, 'production_crm_advocacy_p2', 'Phase 2: Integrations',
      'Phase 2: Integrations', 'production', v_sort, false,
      2, 5, 31,
      public.playbook_task_components_with_resources('[{"id":"playbook-CR-2-1","type":"Internal Milestone","label":"Configure sales pipelines, custom deal stages, and required close fields in CRM.10","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0},{"id":"playbook-CR-2-2","type":"Internal Milestone","label":"Embed form API triggers to automatically sync Webflow demo submissions to CRM.10","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-CR-2-3","type":"Deliverable","label":"Build triggers to automatically create onboarding cards when deals move to Closed-Won.10","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0},{"id":"playbook-CR-2-4","type":"Deliverable","label":"Structure automated onboarding feedback surveys and post-sale referral emails.9","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
  END IF;
END;
 $$;

-- Service templates
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, slug FROM public.process_templates WHERE template_kind = 'service'
  LOOP
    PERFORM public.apply_playbook_pre_delivery(r.id);
    PERFORM public.apply_playbook_service_production(r.id, r.slug);
    PERFORM public.refresh_process_template_metrics(r.id);
  END LOOP;
END $$;

-- Package templates (concatenate included service phases)
DO $$
DECLARE
  v_template_id UUID;
  v_sort INT;
BEGIN
  SELECT id INTO v_template_id FROM public.process_templates WHERE slug = 'launch_kit' LIMIT 1;
  IF v_template_id IS NOT NULL THEN
    PERFORM public.apply_playbook_pre_delivery(v_template_id);
    DELETE FROM public.process_steps WHERE template_id = v_template_id AND track = 'production';
    SELECT COALESCE(MAX(sort_order), 3) INTO v_sort FROM public.process_steps WHERE template_id = v_template_id AND track = 'pre_delivery';
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_strategy_p1', 'Phase 1: Discovery & Research',
      'Phase 1: Discovery & Research', 'production', v_sort, false,
      1, 4, 10.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BS-1-1","type":"Internal Milestone","label":"Clean and organize all qualitative data from Client Intake Questionnaire.3","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-1-2","type":"Internal Milestone","label":"Research direct and indirect competitors'' market positioning and visual strategies.3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-1-3","type":"Internal Milestone","label":"Synthesize competitor positioning vectors into visual comparison slides.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BS-1-4","type":"Deliverable","label":"Present competitor findings to lock down the target strategic positioning \"white space\".3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_strategy_p2', 'Phase 2: Positioning & Storytelling',
      'Phase 2: Positioning & Storytelling', 'production', v_sort, false,
      2, 4, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BS-2-1","type":"Internal Milestone","label":"Draft core brand promise, vision statements, corporate mission, and supporting values.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-2","type":"Internal Milestone","label":"Write the 1-page Story Narrative and Brand Manifest (the core project North Star).3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-3","type":"Internal Milestone","label":"Compile workshop findings and narratives into the final Analysis Summary document.3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-4","type":"Deliverable","label":"Present final positioning and secure client sign-off on the Brand Manifest.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_visual_identity_p1', 'Phase 1: Creative Exploration',
      'Phase 1: Creative Exploration', 'production', v_sort, false,
      1, 2, 7.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-1-1","type":"Internal Milestone","label":"Collect visual references, textures, color moods, and typography ideas in Figma.3","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-1-2","type":"Deliverable","label":"Run a visual mood board call with the client to lock in high-level art direction preferences.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_visual_identity_p2', 'Phase 2: Route Development',
      'Phase 2: Route Development', 'production', v_sort, false,
      2, 6, 30,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-2-1","type":"Internal Milestone","label":"Develop Route 1: The Safe Scaler (High Logic / High Execution) logo and color concepts.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-2-2","type":"Internal Milestone","label":"Develop Route 2: The Market Disruptor (High Creative / High Tone) visual concept patterns.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-2-3","type":"Internal Milestone","label":"Develop Route 3: The Balanced Authority (Medium All) visual system pairings.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_visual_identity_p3', 'Phase 3: Presentation & Alignment',
      'Phase 3: Presentation & Alignment', 'production', v_sort, false,
      3, 4, 12,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-3-1","type":"Internal Milestone","label":"Build objective LTCE Scorecards for all three visual routes based on business fit.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-2","type":"Deliverable","label":"Present the three visual routes, using the LTCE scorecards to guide client choice.3","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-3","type":"Deliverable","label":"Incorporate visual feedback to refine the winning route''s primary mark and assets.3","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-4","type":"Deliverable","label":"Secure formal client signature and sign-off on the final visual system lockup.3","required":true,"duration_days":1,"duration_hours":1,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_guidelines_p1', 'Phase 1: Asset Export',
      'Phase 1: Asset Export', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BG-1-1","type":"Internal Milestone","label":"Export the final approved logo files across formats (SVG, PNG, EPS) into organized folders.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-1-2","type":"Internal Milestone","label":"Structure shared Google Drive directories to compile all production assets.3","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_guidelines_p2', 'Phase 2: Guidelines Creation',
      'Phase 2: Guidelines Creation', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BG-2-1","type":"Internal Milestone","label":"Document precise safe zones, clear-space minimums, scale bounds, and improper usage rules.3","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-2","type":"Internal Milestone","label":"Map primary, secondary, and extended brand color tokens for print and digital setups.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-3","type":"Internal Milestone","label":"Document verbal voice standards, corporate adjectives, vocabulary rules, and copy templates.1","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BG-2-4","type":"Internal Milestone","label":"Compile visual and verbal rules into the complete Master Brand Guidelines book.3","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-5","type":"Deliverable","label":"Deliver finalized guidelines book and folder access links to the client for sign-off.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p1', 'Phase 1: Information Architecture',
      'Phase 1: Information Architecture', 'production', v_sort, false,
      1, 3, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-1-1","type":"Deliverable","label":"Map website sitemap structures and user flow pages in Figma.8","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-2","type":"Internal Milestone","label":"Design low-fidelity wireframes detailing page structure and content placement.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-3","type":"Deliverable","label":"Run low-fidelity wireframe walkthrough to approve layouts and copy hierarchy.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p2', 'Phase 2: High-Fi UI & Design Systems',
      'Phase 2: High-Fi UI & Design Systems', 'production', v_sort, false,
      2, 7, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-2-1","type":"Internal Milestone","label":"Configure global Figma variables (primary colors, font scale tokens, padding values).11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-2","type":"Internal Milestone","label":"Convert wireframes into desktop and mobile mockups using Auto Layout.11","required":false,"duration_days":3,"duration_hours":18,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-3","type":"Internal Milestone","label":"Design interactive components (button hovers, active input states, form success screens).11","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-4","type":"Deliverable","label":"Build click-through prototype flows in Figma to preview responsive user journeys.12","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-5","type":"Deliverable","label":"Walk through high-fidelity designs with client to secure layout sign-off.12","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p1', 'Phase 1: Variables Setup',
      'Phase 1: Variables Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-1-1","type":"Internal Milestone","label":"Clone standard style guides (Client-First / Relume) into the new Webflow workspace.11","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-1-2","type":"Internal Milestone","label":"Connect Figma variables and sync styles (color, typography) to Webflow using the plugin.14","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"website_development","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p2', 'Phase 2: Production Build',
      'Phase 2: Production Build', 'production', v_sort, false,
      2, 5, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-2-1","type":"Internal Milestone","label":"Code section containers, navigation menus, and grid layouts via clean CSS Flexbox.11","required":false,"duration_days":3,"duration_hours":22,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-2","type":"Internal Milestone","label":"Configure CMS collection fields and category mapping for dynamic data models.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-3","type":"Internal Milestone","label":"Program custom hover states, scroll triggers, and native page transition animations.13","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p3', 'Phase 3: Staging, QA & Launch',
      'Phase 3: Staging, QA & Launch', 'production', v_sort, false,
      3, 3, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-3-1","type":"Deliverable","label":"Deploy to staging URLs for multi-device QA checks and layout responsiveness.8","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-3-2","type":"Internal Milestone","label":"Embed SVG custom code, map 301 redirects, compress media, and audit sitemaps.11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-WV-3-3","type":"Deliverable","label":"Link live custom domains, configure DNS target values, and publish live.8","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    PERFORM public.refresh_process_template_metrics(v_template_id);
  END IF;
  SELECT id INTO v_template_id FROM public.process_templates WHERE slug = 'startup_launch' LIMIT 1;
  IF v_template_id IS NOT NULL THEN
    PERFORM public.apply_playbook_pre_delivery(v_template_id);
    DELETE FROM public.process_steps WHERE template_id = v_template_id AND track = 'production';
    SELECT COALESCE(MAX(sort_order), 3) INTO v_sort FROM public.process_steps WHERE template_id = v_template_id AND track = 'pre_delivery';
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_go_to_market_strategy_p1', 'Phase 1: Funnel Diagnostic',
      'Phase 1: Funnel Diagnostic', 'production', v_sort, false,
      1, 2, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-1-1","type":"Internal Milestone","label":"Audit client''s historical site traffic, conversions, active ad spend, and CAC models.17","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-1-2","type":"Internal Milestone","label":"Run competitor research mapping search authority, keyword gaps, and active paid ad strategies.19","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_go_to_market_strategy_p2', 'Phase 2: GTM Playbook',
      'Phase 2: GTM Playbook', 'production', v_sort, false,
      2, 4, 18,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-2-1","type":"Internal Milestone","label":"Model core unit economics (SaaS LTV targets, payback periods, CAC ceilings).9","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-2","type":"Deliverable","label":"Define pipeline target metrics (SQL velocity, Monthly Booked Demos, conversion rates).7","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-3","type":"Internal Milestone","label":"Map budget split channels across organic (SEO, brand) and active paid systems.19","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-4","type":"Deliverable","label":"Draft 12-Month GTM Playbook and conduct alignment walk-through with leadership.1","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p1', 'Phase 1: Information Architecture',
      'Phase 1: Information Architecture', 'production', v_sort, false,
      1, 3, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-1-1","type":"Deliverable","label":"Map website sitemap structures and user flow pages in Figma.8","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-2","type":"Internal Milestone","label":"Design low-fidelity wireframes detailing page structure and content placement.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-3","type":"Deliverable","label":"Run low-fidelity wireframe walkthrough to approve layouts and copy hierarchy.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p2', 'Phase 2: High-Fi UI & Design Systems',
      'Phase 2: High-Fi UI & Design Systems', 'production', v_sort, false,
      2, 7, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-2-1","type":"Internal Milestone","label":"Configure global Figma variables (primary colors, font scale tokens, padding values).11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-2","type":"Internal Milestone","label":"Convert wireframes into desktop and mobile mockups using Auto Layout.11","required":false,"duration_days":3,"duration_hours":18,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-3","type":"Internal Milestone","label":"Design interactive components (button hovers, active input states, form success screens).11","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-4","type":"Deliverable","label":"Build click-through prototype flows in Figma to preview responsive user journeys.12","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-5","type":"Deliverable","label":"Walk through high-fidelity designs with client to secure layout sign-off.12","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p1', 'Phase 1: Variables Setup',
      'Phase 1: Variables Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-1-1","type":"Internal Milestone","label":"Clone standard style guides (Client-First / Relume) into the new Webflow workspace.11","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-1-2","type":"Internal Milestone","label":"Connect Figma variables and sync styles (color, typography) to Webflow using the plugin.14","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"website_development","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p2', 'Phase 2: Production Build',
      'Phase 2: Production Build', 'production', v_sort, false,
      2, 5, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-2-1","type":"Internal Milestone","label":"Code section containers, navigation menus, and grid layouts via clean CSS Flexbox.11","required":false,"duration_days":3,"duration_hours":22,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-2","type":"Internal Milestone","label":"Configure CMS collection fields and category mapping for dynamic data models.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-3","type":"Internal Milestone","label":"Program custom hover states, scroll triggers, and native page transition animations.13","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p3', 'Phase 3: Staging, QA & Launch',
      'Phase 3: Staging, QA & Launch', 'production', v_sort, false,
      3, 3, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-3-1","type":"Deliverable","label":"Deploy to staging URLs for multi-device QA checks and layout responsiveness.8","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-3-2","type":"Internal Milestone","label":"Embed SVG custom code, map 301 redirects, compress media, and audit sitemaps.11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-WV-3-3","type":"Deliverable","label":"Link live custom domains, configure DNS target values, and publish live.8","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_seo_p1', 'Phase 1: On-Page Optimization',
      'Phase 1: On-Page Optimization', 'production', v_sort, false,
      1, 4, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SE-1-1","type":"Internal Milestone","label":"Identify high-intent competitor terms and map commercial bottom-of-funnel content clusters.28","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"seo","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-2","type":"Internal Milestone","label":"Run site health crawl to diagnose GSC page indexing problems, missing tags, and sitemap errors.8","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-3","type":"Internal Milestone","label":"Draft targeted meta titles, description tags, and headers to secure search visibility.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"seo","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SE-1-4","type":"Deliverable","label":"Review monthly content calendar, apply revisions, and publish optimized pages.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"seo","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_social_media_content_p1', 'Phase 1: Content Setup',
      'Phase 1: Content Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-1-1","type":"Deliverable","label":"Map founder''s core pillars (Insights, Story lessons, Client wins) to business objectives.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-1-2","type":"Deliverable","label":"Build monthly publishing calendar containing target post dates and selected formats.34","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_social_media_content_p2', 'Phase 2: Drafting & Styling',
      'Phase 2: Drafting & Styling', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-2-1","type":"Internal Milestone","label":"Batch-write punchy text posts focusing on strong hooks, clear formatting, and value.34","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-2","type":"Internal Milestone","label":"Design custom post images and multi-page carousels to elevate visual scroll-stopping.34","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-SM-2-3","type":"Deliverable","label":"Present monthly drafts, capture founder revisions, and refine hooks.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-4","type":"Deliverable","label":"Schedule approved monthly posts directly within native/platform scheduling systems.34","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    PERFORM public.refresh_process_template_metrics(v_template_id);
  END IF;
  SELECT id INTO v_template_id FROM public.process_templates WHERE slug = 'growth_program' LIMIT 1;
  IF v_template_id IS NOT NULL THEN
    PERFORM public.apply_playbook_pre_delivery(v_template_id);
    DELETE FROM public.process_steps WHERE template_id = v_template_id AND track = 'production';
    SELECT COALESCE(MAX(sort_order), 3) INTO v_sort FROM public.process_steps WHERE template_id = v_template_id AND track = 'pre_delivery';
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_go_to_market_strategy_p1', 'Phase 1: Funnel Diagnostic',
      'Phase 1: Funnel Diagnostic', 'production', v_sort, false,
      1, 2, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-1-1","type":"Internal Milestone","label":"Audit client''s historical site traffic, conversions, active ad spend, and CAC models.17","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-1-2","type":"Internal Milestone","label":"Run competitor research mapping search authority, keyword gaps, and active paid ad strategies.19","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_go_to_market_strategy_p2', 'Phase 2: GTM Playbook',
      'Phase 2: GTM Playbook', 'production', v_sort, false,
      2, 4, 18,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-2-1","type":"Internal Milestone","label":"Model core unit economics (SaaS LTV targets, payback periods, CAC ceilings).9","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-2","type":"Deliverable","label":"Define pipeline target metrics (SQL velocity, Monthly Booked Demos, conversion rates).7","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-3","type":"Internal Milestone","label":"Map budget split channels across organic (SEO, brand) and active paid systems.19","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-4","type":"Deliverable","label":"Draft 12-Month GTM Playbook and conduct alignment walk-through with leadership.1","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p1', 'Phase 1: Information Architecture',
      'Phase 1: Information Architecture', 'production', v_sort, false,
      1, 3, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-1-1","type":"Deliverable","label":"Map website sitemap structures and user flow pages in Figma.8","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-2","type":"Internal Milestone","label":"Design low-fidelity wireframes detailing page structure and content placement.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-3","type":"Deliverable","label":"Run low-fidelity wireframe walkthrough to approve layouts and copy hierarchy.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p2', 'Phase 2: High-Fi UI & Design Systems',
      'Phase 2: High-Fi UI & Design Systems', 'production', v_sort, false,
      2, 7, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-2-1","type":"Internal Milestone","label":"Configure global Figma variables (primary colors, font scale tokens, padding values).11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-2","type":"Internal Milestone","label":"Convert wireframes into desktop and mobile mockups using Auto Layout.11","required":false,"duration_days":3,"duration_hours":18,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-3","type":"Internal Milestone","label":"Design interactive components (button hovers, active input states, form success screens).11","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-4","type":"Deliverable","label":"Build click-through prototype flows in Figma to preview responsive user journeys.12","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-5","type":"Deliverable","label":"Walk through high-fidelity designs with client to secure layout sign-off.12","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p1', 'Phase 1: Variables Setup',
      'Phase 1: Variables Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-1-1","type":"Internal Milestone","label":"Clone standard style guides (Client-First / Relume) into the new Webflow workspace.11","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-1-2","type":"Internal Milestone","label":"Connect Figma variables and sync styles (color, typography) to Webflow using the plugin.14","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"website_development","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p2', 'Phase 2: Production Build',
      'Phase 2: Production Build', 'production', v_sort, false,
      2, 5, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-2-1","type":"Internal Milestone","label":"Code section containers, navigation menus, and grid layouts via clean CSS Flexbox.11","required":false,"duration_days":3,"duration_hours":22,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-2","type":"Internal Milestone","label":"Configure CMS collection fields and category mapping for dynamic data models.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-3","type":"Internal Milestone","label":"Program custom hover states, scroll triggers, and native page transition animations.13","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p3', 'Phase 3: Staging, QA & Launch',
      'Phase 3: Staging, QA & Launch', 'production', v_sort, false,
      3, 3, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-3-1","type":"Deliverable","label":"Deploy to staging URLs for multi-device QA checks and layout responsiveness.8","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-3-2","type":"Internal Milestone","label":"Embed SVG custom code, map 301 redirects, compress media, and audit sitemaps.11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-WV-3-3","type":"Deliverable","label":"Link live custom domains, configure DNS target values, and publish live.8","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_seo_p1', 'Phase 1: On-Page Optimization',
      'Phase 1: On-Page Optimization', 'production', v_sort, false,
      1, 4, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SE-1-1","type":"Internal Milestone","label":"Identify high-intent competitor terms and map commercial bottom-of-funnel content clusters.28","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"seo","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-2","type":"Internal Milestone","label":"Run site health crawl to diagnose GSC page indexing problems, missing tags, and sitemap errors.8","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-3","type":"Internal Milestone","label":"Draft targeted meta titles, description tags, and headers to secure search visibility.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"seo","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SE-1-4","type":"Deliverable","label":"Review monthly content calendar, apply revisions, and publish optimized pages.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"seo","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_social_media_content_p1', 'Phase 1: Content Setup',
      'Phase 1: Content Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-1-1","type":"Deliverable","label":"Map founder''s core pillars (Insights, Story lessons, Client wins) to business objectives.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-1-2","type":"Deliverable","label":"Build monthly publishing calendar containing target post dates and selected formats.34","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_social_media_content_p2', 'Phase 2: Drafting & Styling',
      'Phase 2: Drafting & Styling', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-2-1","type":"Internal Milestone","label":"Batch-write punchy text posts focusing on strong hooks, clear formatting, and value.34","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-2","type":"Internal Milestone","label":"Design custom post images and multi-page carousels to elevate visual scroll-stopping.34","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-SM-2-3","type":"Deliverable","label":"Present monthly drafts, capture founder revisions, and refine hooks.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-4","type":"Deliverable","label":"Schedule approved monthly posts directly within native/platform scheduling systems.34","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_advanced_analytics_p1', 'Phase 1: Tag Audit',
      'Phase 1: Tag Audit', 'production', v_sort, false,
      1, 2, 8,
      public.playbook_task_components_with_resources('[{"id":"playbook-AA-1-1","type":"Internal Milestone","label":"Run technical scripts audit on live pages to catalog tracking scripts and pixel triggers.23","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"advanced_analytics","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-AA-1-2","type":"Deliverable","label":"Draft event taxonomy tracking plan specifying lower-case event names and variables.24","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"advanced_analytics","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_advanced_analytics_p2', 'Phase 2: Implementation',
      'Phase 2: Implementation', 'production', v_sort, false,
      2, 4, 25,
      public.playbook_task_components_with_resources('[{"id":"playbook-AA-2-1","type":"Internal Milestone","label":"Configure custom GA4 event tags (e.g., demo click, pricing view, video completion).7","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0},{"id":"playbook-AA-2-2","type":"Internal Milestone","label":"Inject JS tracking scripts inside Cursor to trigger signup and transaction indicators.23","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Cursor","cost_buffer_percent":0},{"id":"playbook-AA-2-3","type":"Deliverable","label":"Install consent banner controls and configure Google Consent Mode v2 parameters.21","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"advanced_analytics","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-AA-2-4","type":"Deliverable","label":"Build reporting dashboard connecting traffic, ad-platform attribution, and conversions.7","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_campaign_architecture_p1', 'Phase 1: Creative Concept',
      'Phase 1: Creative Concept', 'production', v_sort, false,
      1, 2, 9,
      public.playbook_task_components_with_resources('[{"id":"playbook-CP-1-1","type":"Deliverable","label":"Define campaign business targets, audience focus, and write Campaign Creative Brief.12","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-1-2","type":"Internal Milestone","label":"Design visual campaign styles, layout concept boards, and messaging directions.27","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_campaign_architecture_p2', 'Phase 2: Asset Schedule',
      'Phase 2: Asset Schedule', 'production', v_sort, false,
      2, 4, 16.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-CP-2-1","type":"Deliverable","label":"Build campaign checklist (landing page specs, ad copy assets, outbound tracking).28","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-2","type":"Internal Milestone","label":"Draft ad headline variations, promo copy, email templates, and community shares.12","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-3","type":"Internal Milestone","label":"Map day-by-day launch pipeline tasks, tracking owners, and publish dates.12","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-4","type":"Deliverable","label":"Conduct pre-launch review with client stakeholders and authorize campaign launch.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_paid_performance_p1', 'Phase 1: Targeting Setup',
      'Phase 1: Targeting Setup', 'production', v_sort, false,
      1, 2, 9,
      public.playbook_task_components_with_resources('[{"id":"playbook-PA-1-1","type":"Deliverable","label":"Set up platform audience parameters, upload account lists, and apply seniority exclusions.4","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"paid_performance","resource_name":"Google Ads","cost_buffer_percent":0},{"id":"playbook-PA-1-2","type":"Internal Milestone","label":"Structure campaign architecture matching budgets to Creation, Harvesting, and Conversion.4","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"paid_performance","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_paid_performance_p2', 'Phase 2: Creative & Launch',
      'Phase 2: Creative & Launch', 'production', v_sort, false,
      2, 6, 31,
      public.playbook_task_components_with_resources('[{"id":"playbook-PA-2-1","type":"Internal Milestone","label":"Write conversion ad copies and design visual creatives (Thought Leaders, multi-page PDFs).4","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-PA-2-2","type":"Internal Milestone","label":"Build dedicated, fast high-conversion landing pages to receive campaign traffic.12","required":false,"duration_days":2,"duration_hours":12,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-PA-2-3","type":"Internal Milestone","label":"Map platform conversion triggers and integrate server-side tracking loops.4","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0},{"id":"playbook-PA-2-4","type":"Deliverable","label":"Verify tracking triggers in platform preview states and push ad campaigns live.21","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"paid_performance","resource_name":"Google Ads","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_video_production_p1', 'Phase 1: Pre-Production',
      'Phase 1: Pre-Production', 'production', v_sort, false,
      1, 2, 14,
      public.playbook_task_components_with_resources('[{"id":"playbook-VP-1-1","type":"Deliverable","label":"Write dual-column AV scripts mapping scene dialogue to visual graphic instructions.27","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-VP-1-2","type":"Deliverable","label":"Design storyboards in Figma to pre-visualize lighting angles, frames, and overlays.35","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_video_production_p2', 'Phase 2: Shooting & Post',
      'Phase 2: Shooting & Post', 'production', v_sort, false,
      2, 5, 26,
      public.playbook_task_components_with_resources('[{"id":"playbook-VP-2-1","type":"Deliverable","label":"Configure camera gear, test high-fidelity audio equipment, and run recording sessions.27","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"video_production","resource_name":"Adobe Creative Cloud","cost_buffer_percent":0},{"id":"playbook-VP-2-2","type":"Internal Milestone","label":"Edit footage timeline sequences, run color grading, and balance audio mixes.29","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"video_production","resource_name":"Adobe Creative Cloud","cost_buffer_percent":0},{"id":"playbook-VP-2-3","type":"Internal Milestone","label":"Design matching overlay graphics, dynamic typography, and title frames in Figma.35","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VP-2-4","type":"Deliverable","label":"Deliver final polished draft cuts to the client and secure video launch sign-off.27","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"video_production","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    PERFORM public.refresh_process_template_metrics(v_template_id);
  END IF;
  SELECT id INTO v_template_id FROM public.process_templates WHERE slug = 'full_partnership' LIMIT 1;
  IF v_template_id IS NOT NULL THEN
    PERFORM public.apply_playbook_pre_delivery(v_template_id);
    DELETE FROM public.process_steps WHERE template_id = v_template_id AND track = 'production';
    SELECT COALESCE(MAX(sort_order), 3) INTO v_sort FROM public.process_steps WHERE template_id = v_template_id AND track = 'pre_delivery';
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_go_to_market_strategy_p1', 'Phase 1: Funnel Diagnostic',
      'Phase 1: Funnel Diagnostic', 'production', v_sort, false,
      1, 2, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-1-1","type":"Internal Milestone","label":"Audit client''s historical site traffic, conversions, active ad spend, and CAC models.17","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-1-2","type":"Internal Milestone","label":"Run competitor research mapping search authority, keyword gaps, and active paid ad strategies.19","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_go_to_market_strategy_p2', 'Phase 2: GTM Playbook',
      'Phase 2: GTM Playbook', 'production', v_sort, false,
      2, 4, 18,
      public.playbook_task_components_with_resources('[{"id":"playbook-MS-2-1","type":"Internal Milestone","label":"Model core unit economics (SaaS LTV targets, payback periods, CAC ceilings).9","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-2","type":"Deliverable","label":"Define pipeline target metrics (SQL velocity, Monthly Booked Demos, conversion rates).7","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-3","type":"Internal Milestone","label":"Map budget split channels across organic (SEO, brand) and active paid systems.19","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MS-2-4","type":"Deliverable","label":"Draft 12-Month GTM Playbook and conduct alignment walk-through with leadership.1","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_advanced_analytics_p1', 'Phase 1: Tag Audit',
      'Phase 1: Tag Audit', 'production', v_sort, false,
      1, 2, 8,
      public.playbook_task_components_with_resources('[{"id":"playbook-AA-1-1","type":"Internal Milestone","label":"Run technical scripts audit on live pages to catalog tracking scripts and pixel triggers.23","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"advanced_analytics","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-AA-1-2","type":"Deliverable","label":"Draft event taxonomy tracking plan specifying lower-case event names and variables.24","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"advanced_analytics","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_advanced_analytics_p2', 'Phase 2: Implementation',
      'Phase 2: Implementation', 'production', v_sort, false,
      2, 4, 25,
      public.playbook_task_components_with_resources('[{"id":"playbook-AA-2-1","type":"Internal Milestone","label":"Configure custom GA4 event tags (e.g., demo click, pricing view, video completion).7","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0},{"id":"playbook-AA-2-2","type":"Internal Milestone","label":"Inject JS tracking scripts inside Cursor to trigger signup and transaction indicators.23","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Cursor","cost_buffer_percent":0},{"id":"playbook-AA-2-3","type":"Deliverable","label":"Install consent banner controls and configure Google Consent Mode v2 parameters.21","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"advanced_analytics","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-AA-2-4","type":"Deliverable","label":"Build reporting dashboard connecting traffic, ad-platform attribution, and conversions.7","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_campaign_architecture_p1', 'Phase 1: Creative Concept',
      'Phase 1: Creative Concept', 'production', v_sort, false,
      1, 2, 9,
      public.playbook_task_components_with_resources('[{"id":"playbook-CP-1-1","type":"Deliverable","label":"Define campaign business targets, audience focus, and write Campaign Creative Brief.12","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-1-2","type":"Internal Milestone","label":"Design visual campaign styles, layout concept boards, and messaging directions.27","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_campaign_architecture_p2', 'Phase 2: Asset Schedule',
      'Phase 2: Asset Schedule', 'production', v_sort, false,
      2, 4, 16.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-CP-2-1","type":"Deliverable","label":"Build campaign checklist (landing page specs, ad copy assets, outbound tracking).28","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-2","type":"Internal Milestone","label":"Draft ad headline variations, promo copy, email templates, and community shares.12","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-3","type":"Internal Milestone","label":"Map day-by-day launch pipeline tasks, tracking owners, and publish dates.12","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CP-2-4","type":"Deliverable","label":"Conduct pre-launch review with client stakeholders and authorize campaign launch.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"go_to_market_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_strategy_p1', 'Phase 1: Discovery & Research',
      'Phase 1: Discovery & Research', 'production', v_sort, false,
      1, 4, 10.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BS-1-1","type":"Internal Milestone","label":"Clean and organize all qualitative data from Client Intake Questionnaire.3","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-1-2","type":"Internal Milestone","label":"Research direct and indirect competitors'' market positioning and visual strategies.3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-1-3","type":"Internal Milestone","label":"Synthesize competitor positioning vectors into visual comparison slides.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BS-1-4","type":"Deliverable","label":"Present competitor findings to lock down the target strategic positioning \"white space\".3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_strategy_p2', 'Phase 2: Positioning & Storytelling',
      'Phase 2: Positioning & Storytelling', 'production', v_sort, false,
      2, 4, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BS-2-1","type":"Internal Milestone","label":"Draft core brand promise, vision statements, corporate mission, and supporting values.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-2","type":"Internal Milestone","label":"Write the 1-page Story Narrative and Brand Manifest (the core project North Star).3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-3","type":"Internal Milestone","label":"Compile workshop findings and narratives into the final Analysis Summary document.3","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BS-2-4","type":"Deliverable","label":"Present final positioning and secure client sign-off on the Brand Manifest.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_visual_identity_p1', 'Phase 1: Creative Exploration',
      'Phase 1: Creative Exploration', 'production', v_sort, false,
      1, 2, 7.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-1-1","type":"Internal Milestone","label":"Collect visual references, textures, color moods, and typography ideas in Figma.3","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-1-2","type":"Deliverable","label":"Run a visual mood board call with the client to lock in high-level art direction preferences.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_visual_identity_p2', 'Phase 2: Route Development',
      'Phase 2: Route Development', 'production', v_sort, false,
      2, 6, 30,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-2-1","type":"Internal Milestone","label":"Develop Route 1: The Safe Scaler (High Logic / High Execution) logo and color concepts.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-2-2","type":"Internal Milestone","label":"Develop Route 2: The Market Disruptor (High Creative / High Tone) visual concept patterns.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-2-3","type":"Internal Milestone","label":"Develop Route 3: The Balanced Authority (Medium All) visual system pairings.3","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_visual_identity_p3', 'Phase 3: Presentation & Alignment',
      'Phase 3: Presentation & Alignment', 'production', v_sort, false,
      3, 4, 12,
      public.playbook_task_components_with_resources('[{"id":"playbook-VI-3-1","type":"Internal Milestone","label":"Build objective LTCE Scorecards for all three visual routes based on business fit.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-2","type":"Deliverable","label":"Present the three visual routes, using the LTCE scorecards to guide client choice.3","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"brand_strategy","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-3","type":"Deliverable","label":"Incorporate visual feedback to refine the winning route''s primary mark and assets.3","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VI-3-4","type":"Deliverable","label":"Secure formal client signature and sign-off on the final visual system lockup.3","required":true,"duration_days":1,"duration_hours":1,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_guidelines_p1', 'Phase 1: Asset Export',
      'Phase 1: Asset Export', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BG-1-1","type":"Internal Milestone","label":"Export the final approved logo files across formats (SVG, PNG, EPS) into organized folders.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-1-2","type":"Internal Milestone","label":"Structure shared Google Drive directories to compile all production assets.3","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_brand_guidelines_p2', 'Phase 2: Guidelines Creation',
      'Phase 2: Guidelines Creation', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-BG-2-1","type":"Internal Milestone","label":"Document precise safe zones, clear-space minimums, scale bounds, and improper usage rules.3","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-2","type":"Internal Milestone","label":"Map primary, secondary, and extended brand color tokens for print and digital setups.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-3","type":"Internal Milestone","label":"Document verbal voice standards, corporate adjectives, vocabulary rules, and copy templates.1","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-BG-2-4","type":"Internal Milestone","label":"Compile visual and verbal rules into the complete Master Brand Guidelines book.3","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-BG-2-5","type":"Deliverable","label":"Deliver finalized guidelines book and folder access links to the client for sign-off.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_messaging_communications_p1', 'Phase 1: Persona Formulation',
      'Phase 1: Persona Formulation', 'production', v_sort, false,
      1, 2, 7.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-MC-1-1","type":"Internal Milestone","label":"Document 2-3 target customer personas (business KPIs, pain points, tool stacks, objections).9","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-1-2","type":"Deliverable","label":"Lead persona review call with sales/marketing stakeholders to validate real-world accuracy.10","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_messaging_communications_p2', 'Phase 2: Architecture & Copy Guides',
      'Phase 2: Architecture & Copy Guides', 'production', v_sort, false,
      2, 4, 18.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-MC-2-1","type":"Internal Milestone","label":"Draft core promise, secondary value pillars, and software feature-to-benefit matrices.9","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-2-2","type":"Internal Milestone","label":"Write conversational tags, company elevator pitches, and cold sales email scripts.1","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-2-3","type":"Internal Milestone","label":"Format positioning guides and messaging templates into a clean copy framework sheet.3","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-MC-2-4","type":"Deliverable","label":"Review copy frameworks with executive team and secure final messaging sign-off.3","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p1', 'Phase 1: Information Architecture',
      'Phase 1: Information Architecture', 'production', v_sort, false,
      1, 3, 12.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-1-1","type":"Deliverable","label":"Map website sitemap structures and user flow pages in Figma.8","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-2","type":"Internal Milestone","label":"Design low-fidelity wireframes detailing page structure and content placement.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-1-3","type":"Deliverable","label":"Run low-fidelity wireframe walkthrough to approve layouts and copy hierarchy.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_ui_ux_design_p2', 'Phase 2: High-Fi UI & Design Systems',
      'Phase 2: High-Fi UI & Design Systems', 'production', v_sort, false,
      2, 7, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WD-2-1","type":"Internal Milestone","label":"Configure global Figma variables (primary colors, font scale tokens, padding values).11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-2","type":"Internal Milestone","label":"Convert wireframes into desktop and mobile mockups using Auto Layout.11","required":false,"duration_days":3,"duration_hours":18,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-3","type":"Internal Milestone","label":"Design interactive components (button hovers, active input states, form success screens).11","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-4","type":"Deliverable","label":"Build click-through prototype flows in Figma to preview responsive user journeys.12","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-WD-2-5","type":"Deliverable","label":"Walk through high-fidelity designs with client to secure layout sign-off.12","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p1', 'Phase 1: Variables Setup',
      'Phase 1: Variables Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-1-1","type":"Internal Milestone","label":"Clone standard style guides (Client-First / Relume) into the new Webflow workspace.11","required":false,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-1-2","type":"Internal Milestone","label":"Connect Figma variables and sync styles (color, typography) to Webflow using the plugin.14","required":false,"duration_days":1,"duration_hours":3,"expertise_slug":"website_development","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p2', 'Phase 2: Production Build',
      'Phase 2: Production Build', 'production', v_sort, false,
      2, 5, 36,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-2-1","type":"Internal Milestone","label":"Code section containers, navigation menus, and grid layouts via clean CSS Flexbox.11","required":false,"duration_days":3,"duration_hours":22,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-2","type":"Internal Milestone","label":"Configure CMS collection fields and category mapping for dynamic data models.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-2-3","type":"Internal Milestone","label":"Program custom hover states, scroll triggers, and native page transition animations.13","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_website_development_p3', 'Phase 3: Staging, QA & Launch',
      'Phase 3: Staging, QA & Launch', 'production', v_sort, false,
      3, 3, 11,
      public.playbook_task_components_with_resources('[{"id":"playbook-WV-3-1","type":"Deliverable","label":"Deploy to staging URLs for multi-device QA checks and layout responsiveness.8","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-WV-3-2","type":"Internal Milestone","label":"Embed SVG custom code, map 301 redirects, compress media, and audit sitemaps.11","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-WV-3-3","type":"Deliverable","label":"Link live custom domains, configure DNS target values, and publish live.8","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_seo_p1', 'Phase 1: On-Page Optimization',
      'Phase 1: On-Page Optimization', 'production', v_sort, false,
      1, 4, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SE-1-1","type":"Internal Milestone","label":"Identify high-intent competitor terms and map commercial bottom-of-funnel content clusters.28","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"seo","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-2","type":"Internal Milestone","label":"Run site health crawl to diagnose GSC page indexing problems, missing tags, and sitemap errors.8","required":false,"duration_days":1,"duration_hours":5,"expertise_slug":"website_development","resource_name":"Google Search Console","cost_buffer_percent":0},{"id":"playbook-SE-1-3","type":"Internal Milestone","label":"Draft targeted meta titles, description tags, and headers to secure search visibility.8","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"seo","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SE-1-4","type":"Deliverable","label":"Review monthly content calendar, apply revisions, and publish optimized pages.12","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"seo","resource_name":"Webflow Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_paid_performance_p1', 'Phase 1: Targeting Setup',
      'Phase 1: Targeting Setup', 'production', v_sort, false,
      1, 2, 9,
      public.playbook_task_components_with_resources('[{"id":"playbook-PA-1-1","type":"Deliverable","label":"Set up platform audience parameters, upload account lists, and apply seniority exclusions.4","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"paid_performance","resource_name":"Google Ads","cost_buffer_percent":0},{"id":"playbook-PA-1-2","type":"Internal Milestone","label":"Structure campaign architecture matching budgets to Creation, Harvesting, and Conversion.4","required":false,"duration_days":1,"duration_hours":4,"expertise_slug":"paid_performance","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_paid_performance_p2', 'Phase 2: Creative & Launch',
      'Phase 2: Creative & Launch', 'production', v_sort, false,
      2, 6, 31,
      public.playbook_task_components_with_resources('[{"id":"playbook-PA-2-1","type":"Internal Milestone","label":"Write conversion ad copies and design visual creatives (Thought Leaders, multi-page PDFs).4","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-PA-2-2","type":"Internal Milestone","label":"Build dedicated, fast high-conversion landing pages to receive campaign traffic.12","required":false,"duration_days":2,"duration_hours":12,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-PA-2-3","type":"Internal Milestone","label":"Map platform conversion triggers and integrate server-side tracking loops.4","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"advanced_analytics","resource_name":"Analytics Platform Seat","cost_buffer_percent":0},{"id":"playbook-PA-2-4","type":"Deliverable","label":"Verify tracking triggers in platform preview states and push ad campaigns live.21","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"paid_performance","resource_name":"Google Ads","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_crm_advocacy_p1', 'Phase 1: Pipeline Architecture',
      'Phase 1: Pipeline Architecture', 'production', v_sort, false,
      1, 2, 10,
      public.playbook_task_components_with_resources('[{"id":"playbook-CR-1-1","type":"Deliverable","label":"Audit internal lead-handling steps, manual handovers, and customer bottlenecks.10","required":true,"duration_days":1,"duration_hours":4,"expertise_slug":"crm_advocacy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-CR-1-2","type":"Internal Milestone","label":"Design custom deal properties, pipeline stages, and onboarding checklists.37","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_crm_advocacy_p2', 'Phase 2: Integrations',
      'Phase 2: Integrations', 'production', v_sort, false,
      2, 5, 31,
      public.playbook_task_components_with_resources('[{"id":"playbook-CR-2-1","type":"Internal Milestone","label":"Configure sales pipelines, custom deal stages, and required close fields in CRM.10","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0},{"id":"playbook-CR-2-2","type":"Internal Milestone","label":"Embed form API triggers to automatically sync Webflow demo submissions to CRM.10","required":false,"duration_days":1,"duration_hours":8,"expertise_slug":"website_development","resource_name":"Webflow Workspace","cost_buffer_percent":0},{"id":"playbook-CR-2-3","type":"Deliverable","label":"Build triggers to automatically create onboarding cards when deals move to Closed-Won.10","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0},{"id":"playbook-CR-2-4","type":"Deliverable","label":"Structure automated onboarding feedback surveys and post-sale referral emails.9","required":true,"duration_days":1,"duration_hours":5,"expertise_slug":"crm_advocacy","resource_name":"CRM Automation Connector","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_social_media_content_p1', 'Phase 1: Content Setup',
      'Phase 1: Content Setup', 'production', v_sort, false,
      1, 2, 5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-1-1","type":"Deliverable","label":"Map founder''s core pillars (Insights, Story lessons, Client wins) to business objectives.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"brand_strategy","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-1-2","type":"Deliverable","label":"Build monthly publishing calendar containing target post dates and selected formats.34","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_social_media_content_p2', 'Phase 2: Drafting & Styling',
      'Phase 2: Drafting & Styling', 'production', v_sort, false,
      2, 5, 20.5,
      public.playbook_task_components_with_resources('[{"id":"playbook-SM-2-1","type":"Internal Milestone","label":"Batch-write punchy text posts focusing on strong hooks, clear formatting, and value.34","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-2","type":"Internal Milestone","label":"Design custom post images and multi-page carousels to elevate visual scroll-stopping.34","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-SM-2-3","type":"Deliverable","label":"Present monthly drafts, capture founder revisions, and refine hooks.33","required":true,"duration_days":1,"duration_hours":3,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-SM-2-4","type":"Deliverable","label":"Schedule approved monthly posts directly within native/platform scheduling systems.34","required":true,"duration_days":1,"duration_hours":1.5,"expertise_slug":"social_media_content","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_video_production_p1', 'Phase 1: Pre-Production',
      'Phase 1: Pre-Production', 'production', v_sort, false,
      1, 2, 14,
      public.playbook_task_components_with_resources('[{"id":"playbook-VP-1-1","type":"Deliverable","label":"Write dual-column AV scripts mapping scene dialogue to visual graphic instructions.27","required":true,"duration_days":1,"duration_hours":6,"expertise_slug":"messaging_communications","resource_name":"Google Workspace","cost_buffer_percent":0},{"id":"playbook-VP-1-2","type":"Deliverable","label":"Design storyboards in Figma to pre-visualize lighting angles, frames, and overlays.35","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0}]'::jsonb)
    );
    v_sort := v_sort + 1;
    INSERT INTO public.process_steps (
      template_id, step_key, title, operational_intent, track, sort_order, is_locked,
      phase_number, duration_days, duration_hours, task_components
    ) VALUES (
      v_template_id, 'production_video_production_p2', 'Phase 2: Shooting & Post',
      'Phase 2: Shooting & Post', 'production', v_sort, false,
      2, 5, 26,
      public.playbook_task_components_with_resources('[{"id":"playbook-VP-2-1","type":"Deliverable","label":"Configure camera gear, test high-fidelity audio equipment, and run recording sessions.27","required":true,"duration_days":1,"duration_hours":8,"expertise_slug":"video_production","resource_name":"Adobe Creative Cloud","cost_buffer_percent":0},{"id":"playbook-VP-2-2","type":"Internal Milestone","label":"Edit footage timeline sequences, run color grading, and balance audio mixes.29","required":false,"duration_days":2,"duration_hours":10,"expertise_slug":"video_production","resource_name":"Adobe Creative Cloud","cost_buffer_percent":0},{"id":"playbook-VP-2-3","type":"Internal Milestone","label":"Design matching overlay graphics, dynamic typography, and title frames in Figma.35","required":false,"duration_days":1,"duration_hours":6,"expertise_slug":"ui_ux_design","resource_name":"Figma Professional","cost_buffer_percent":0},{"id":"playbook-VP-2-4","type":"Deliverable","label":"Deliver final polished draft cuts to the client and secure video launch sign-off.27","required":true,"duration_days":1,"duration_hours":2,"expertise_slug":"video_production","resource_name":"Google Workspace","cost_buffer_percent":0}]'::jsonb)
    );
    PERFORM public.refresh_process_template_metrics(v_template_id);
  END IF;
END $$;

SELECT public.refresh_all_process_template_metrics();

DROP FUNCTION IF EXISTS public.apply_playbook_service_production(UUID, TEXT);
DROP FUNCTION IF EXISTS public.apply_playbook_pre_delivery(UUID);
DROP FUNCTION IF EXISTS public.playbook_task_components_with_resources(JSONB);
DROP FUNCTION IF EXISTS public.playbook_resource_id(TEXT);