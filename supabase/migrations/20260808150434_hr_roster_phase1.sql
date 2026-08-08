-- HR Roster Phase 1: engagement types, skills, extend people (additive)
-- Reuses public.people — does not replace person_type / capacity fields used by PM costing.

CREATE TABLE IF NOT EXISTS public.engagement_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  default_comp_model text NOT NULL DEFAULT 'hourly_invoice'
    CHECK (default_comp_model IN (
      'retainer',
      'hourly_invoice',
      'fixed_wage',
      'referral_percentage',
      'non_monetary',
      'equity',
      'de_full_time_salary'
    )),
  assignable_to_tasks boolean NOT NULL DEFAULT true,
  requires_contract_doc boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.engagement_types (key, label, default_comp_model, assignable_to_tasks, requires_contract_doc, sort_order)
VALUES
  ('core', 'Founder / Core', 'equity', true, false, 10),
  ('mini_job', 'Mini-Job Agreement', 'fixed_wage', true, true, 20),
  ('recurring_freelancer', 'Recurring Freelancer', 'retainer', true, true, 30),
  ('project_freelancer', 'Project Freelancer', 'hourly_invoice', true, true, 40),
  ('bd_referral_partner', 'BD / Referral Partner', 'referral_percentage', false, false, 50),
  ('future_employee', 'Future Employee (reserved)', 'de_full_time_salary', false, true, 90)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.skills (label)
VALUES
  ('ui-design'),
  ('film-production'),
  ('photo-production'),
  ('seo'),
  ('copywriting'),
  ('bd'),
  ('tax-accounting'),
  ('brand-strategy'),
  ('web-development'),
  ('project-management')
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.person_skills (
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, skill_id)
);

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS engagement_type_id uuid REFERENCES public.engagement_types(id),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS roster_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS bio_notes text,
  ADD COLUMN IF NOT EXISTS rate_notes text,
  ADD COLUMN IF NOT EXISTS co_founder_track boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS co_founder_track_notes text;

DO $$ BEGIN
  ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_roster_status_check;
  ALTER TABLE public.people ADD CONSTRAINT people_roster_status_check
    CHECK (roster_status IN ('active', 'paused', 'offboarded', 'pipeline'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS people_engagement_type_id_idx ON public.people (engagement_type_id);
CREATE INDEX IF NOT EXISTS people_roster_status_idx ON public.people (roster_status);
CREATE INDEX IF NOT EXISTS person_skills_skill_id_idx ON public.person_skills (skill_id);

COMMENT ON COLUMN public.people.roster_status IS 'HR roster lifecycle: active | paused | offboarded | pipeline';
COMMENT ON COLUMN public.people.engagement_type_id IS 'HR engagement type; person_type kept for legacy capacity consumers';

UPDATE public.people p
SET engagement_type_id = et.id
FROM public.engagement_types et
WHERE p.engagement_type_id IS NULL
  AND et.key = CASE
    WHEN lower(coalesce(p.person_type, '')) LIKE '%founder%' THEN 'core'
    WHEN lower(coalesce(p.person_type, '')) LIKE '%intern%' THEN 'mini_job'
    WHEN lower(coalesce(p.person_type, '')) LIKE '%partner%' THEN 'bd_referral_partner'
    WHEN lower(coalesce(p.person_type, '')) LIKE '%freelance%' THEN 'project_freelancer'
    ELSE 'project_freelancer'
  END;

ALTER TABLE public.engagement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access engagement_types" ON public.engagement_types;
CREATE POLICY "Admins full access engagement_types"
  ON public.engagement_types
  FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "Admins full access skills" ON public.skills;
CREATE POLICY "Admins full access skills"
  ON public.skills
  FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "Admins full access person_skills" ON public.person_skills;
CREATE POLICY "Admins full access person_skills"
  ON public.person_skills
  FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "Admins full access people" ON public.people;
CREATE POLICY "Admins full access people"
  ON public.people
  FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engagement_types TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_skills TO authenticated, anon, service_role;
