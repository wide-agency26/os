-- HR Roster Phases 2–7: compensation, salary breakdowns, documents,
-- pipeline, ESOP, playbook RACI (task_templates). Additive only.

-- ---------------------------------------------------------------------------
-- compensation_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compensation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  comp_model text NOT NULL
    CHECK (comp_model IN (
      'retainer',
      'hourly_invoice',
      'fixed_wage',
      'referral_percentage',
      'non_monetary',
      'equity',
      'de_full_time_salary'
    )),
  amount numeric,
  currency text NOT NULL DEFAULT 'EUR',
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly', 'per_project', 'per_hour', 'one_off', 'n/a')),
  non_monetary_description text,
  referral_percentage numeric,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  accounting_ref_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS compensation_records_person_id_idx
  ON public.compensation_records (person_id);
CREATE INDEX IF NOT EXISTS compensation_records_effective_idx
  ON public.compensation_records (effective_from, effective_to);

-- ---------------------------------------------------------------------------
-- salary_breakdowns (DE full-time detail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compensation_record_id uuid NOT NULL REFERENCES public.compensation_records(id) ON DELETE CASCADE,
  gross_salary numeric NOT NULL DEFAULT 0,
  pension_employee numeric NOT NULL DEFAULT 0,
  pension_employer numeric NOT NULL DEFAULT 0,
  unemployment_employee numeric NOT NULL DEFAULT 0,
  unemployment_employer numeric NOT NULL DEFAULT 0,
  health_employee numeric NOT NULL DEFAULT 0,
  health_employer numeric NOT NULL DEFAULT 0,
  care_employee numeric NOT NULL DEFAULT 0,
  care_employer numeric NOT NULL DEFAULT 0,
  income_tax numeric NOT NULL DEFAULT 0,
  employer_surcharges numeric NOT NULL DEFAULT 0,
  accident_insurance numeric NOT NULL DEFAULT 0,
  payslip_payout numeric NOT NULL DEFAULT 0,
  post_tax_direct_debit_tk numeric NOT NULL DEFAULT 0,
  true_usable_income numeric NOT NULL DEFAULT 0,
  period_month integer CHECK (period_month IS NULL OR (period_month BETWEEN 1 AND 12)),
  period_year integer CHECK (period_year IS NULL OR (period_year BETWEEN 2000 AND 2100)),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS salary_breakdowns_comp_idx
  ON public.salary_breakdowns (compensation_record_id);

-- ---------------------------------------------------------------------------
-- hr_documents (roster-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hr_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  doc_type text NOT NULL
    CHECK (doc_type IN ('contract', 'nda', 'mini_job_agreement', 'invoice', 'other')),
  file_path text NOT NULL,
  file_name text,
  file_url text,
  uploaded_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS hr_documents_person_id_idx ON public.hr_documents (person_id);

-- ---------------------------------------------------------------------------
-- roster_pipeline
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roster_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text,
  notes text,
  stage text NOT NULL DEFAULT 'met'
    CHECK (stage IN ('met', 'testing', 'onboarding', 'converted', 'passed')),
  converted_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS roster_pipeline_stage_idx ON public.roster_pipeline (stage);

-- ---------------------------------------------------------------------------
-- esop_allocations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.esop_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  pool_percentage numeric NOT NULL DEFAULT 0,
  vesting_notes text,
  granted_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS esop_allocations_person_id_idx ON public.esop_allocations (person_id);

-- ---------------------------------------------------------------------------
-- playbook_step_roles → task_templates (no playbook_steps table exists)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.playbook_step_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_template_id uuid NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  raci text NOT NULL
    CHECK (raci IN ('responsible', 'accountable', 'consulted', 'informed')),
  required_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  required_engagement_type_id uuid REFERENCES public.engagement_types(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS playbook_step_roles_template_idx
  ON public.playbook_step_roles (task_template_id);

-- ---------------------------------------------------------------------------
-- Accounting read view (cost-facing; DE employer cost derived)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.hr_compensation_ledger
WITH (security_invoker = true)
AS
SELECT
  cr.id AS compensation_record_id,
  cr.person_id,
  p.full_name,
  p.primary_email,
  et.key AS engagement_type_key,
  et.label AS engagement_type_label,
  cr.comp_model,
  cr.amount,
  cr.currency,
  cr.frequency,
  cr.non_monetary_description,
  cr.referral_percentage,
  cr.effective_from,
  cr.effective_to,
  cr.accounting_ref_id,
  sb.id AS salary_breakdown_id,
  sb.gross_salary,
  sb.payslip_payout,
  sb.true_usable_income,
  sb.period_month,
  sb.period_year,
  CASE
    WHEN cr.comp_model = 'de_full_time_salary' AND sb.id IS NOT NULL THEN
      COALESCE(sb.gross_salary, 0)
      + COALESCE(sb.pension_employer, 0)
      + COALESCE(sb.unemployment_employer, 0)
      + COALESCE(sb.health_employer, 0)
      + COALESCE(sb.care_employer, 0)
      + COALESCE(sb.employer_surcharges, 0)
      + COALESCE(sb.accident_insurance, 0)
    ELSE cr.amount
  END AS accounting_cost
FROM public.compensation_records cr
JOIN public.people p ON p.id = cr.person_id
LEFT JOIN public.engagement_types et ON et.id = p.engagement_type_id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.salary_breakdowns s
  WHERE s.compensation_record_id = cr.id
  ORDER BY s.period_year DESC NULLS LAST, s.period_month DESC NULLS LAST, s.created_at DESC
  LIMIT 1
) sb ON true;

-- ---------------------------------------------------------------------------
-- Storage bucket for roster docs
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-roster-docs',
  'hr-roster-docs',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins read hr-roster-docs" ON storage.objects;
CREATE POLICY "Admins read hr-roster-docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hr-roster-docs'
    AND get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );

DROP POLICY IF EXISTS "Admins write hr-roster-docs" ON storage.objects;
CREATE POLICY "Admins write hr-roster-docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hr-roster-docs'
    AND get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );

DROP POLICY IF EXISTS "Admins update hr-roster-docs" ON storage.objects;
CREATE POLICY "Admins update hr-roster-docs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'hr-roster-docs'
    AND get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );

DROP POLICY IF EXISTS "Admins delete hr-roster-docs" ON storage.objects;
CREATE POLICY "Admins delete hr-roster-docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'hr-roster-docs'
    AND get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])
  );

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.compensation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esop_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_step_roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'compensation_records',
    'salary_breakdowns',
    'hr_documents',
    'roster_pipeline',
    'esop_allocations',
    'playbook_step_roles'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Admins full access '||t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (get_user_role() = ANY (ARRAY[''admin''::text, ''superadmin''::text])) WITH CHECK (get_user_role() = ANY (ARRAY[''admin''::text, ''superadmin''::text]))',
      'Admins full access '||t,
      t
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, anon, service_role',
      t
    );
  END LOOP;
END $$;

GRANT SELECT ON public.hr_compensation_ledger TO authenticated, anon, service_role;
