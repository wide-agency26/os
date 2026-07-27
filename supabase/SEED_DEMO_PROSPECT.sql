-- Demo BD prospect + published proposal for portal testing.
-- Run after migrations 006–008 and at least one superadmin profile exists.
--
-- 1) Set :lead_admin_id to your superadmin (or bd_manager) profile id:
--    SELECT id, email, role FROM public.profiles WHERE role IN ('superadmin', 'admin', 'bd_manager');
--
-- 2) Optionally set :client_id to a client profile for kickoff gate demo:
--    SELECT id, full_name FROM public.profiles WHERE role = 'client' LIMIT 1;

-- ── Replace these before running ──────────────────────────────────────────
-- \set lead_admin_id '00000000-0000-0000-0000-000000000001'
-- \set client_id     '00000000-0000-0000-0000-000000000002'

DO $$
DECLARE
  v_lead UUID := NULL; -- paste superadmin / bd_manager profile id
  v_client UUID := NULL; -- optional: client profile id for delivery gates
  v_prospect UUID;
BEGIN
  IF v_lead IS NULL THEN
    SELECT id INTO v_lead
    FROM public.profiles
    WHERE role IN ('superadmin', 'admin', 'bd_manager')
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'No lead admin found. Bootstrap a superadmin profile first.';
  END IF;

  INSERT INTO public.prospects (
    company_name,
    contact_name,
    contact_email,
    status,
    lead_admin_id,
    notes
  )
  VALUES (
    'Acme Growth Co.',
    'Jordan Lee',
    'jordan@acmegrowth.example',
    'proposal',
    v_lead,
    'Demo prospect seeded for WIDE OS BD + prospect portal testing.'
  )
  RETURNING id INTO v_prospect;

  INSERT INTO public.prospect_proposals (
    prospect_id,
    title,
    executive_summary,
    scope_sections,
    timeline,
    investment,
    sow_draft,
    is_published,
    published_at
  )
  VALUES (
    v_prospect,
    'Acme Growth Co. — Brand & Web Partnership',
    'WIDE will deliver a unified brand system and marketing site aligned to your growth targets for H2.',
    '[
      {"heading": "Brand foundation", "body": "Positioning workshop, visual identity, and voice guidelines."},
      {"heading": "Web experience", "body": "Design system, key templates, and launch-ready marketing site."}
    ]'::jsonb,
    '[
      {"label": "Discovery", "dates": "Weeks 1–2"},
      {"label": "Creative routes", "dates": "Weeks 3–4"},
      {"label": "Build & launch", "dates": "Weeks 5–10"}
    ]'::jsonb,
    '{"label": "Program investment", "amount": "$48,000", "notes": "50% kickoff · 50% at launch"}'::jsonb,
    'Draft SOW: two revision rounds per milestone; client provides copy by Week 3.',
    true,
    now()
  );

  IF v_client IS NULL THEN
    SELECT id INTO v_client FROM public.profiles WHERE role = 'client' ORDER BY created_at LIMIT 1;
  END IF;

  IF v_client IS NOT NULL THEN
    INSERT INTO public.client_delivery_gates (client_id, creative_routes)
    VALUES (
      v_client,
      '[
        {"id": "route-a", "name": "Bold clarity", "logic": "Lead with proof", "tone": "Confident", "creative": "High contrast", "execution": "Hero + case studies"},
        {"id": "route-b", "name": "Warm craft", "logic": "Human-first", "tone": "Approachable", "creative": "Organic textures", "execution": "Story-led homepage"}
      ]'::jsonb
    )
    ON CONFLICT (client_id) DO UPDATE
    SET creative_routes = EXCLUDED.creative_routes,
        updated_at = now();
  END IF;

  RAISE NOTICE 'Demo prospect id: %', v_prospect;
  RAISE NOTICE 'Prospect portal: /prospect/%/proposal', v_prospect;
  IF v_client IS NOT NULL THEN
    RAISE NOTICE 'Kickoff (client %): /client/%/kickoff/phase-3-alignment', v_client, v_client;
  END IF;
END $$;
