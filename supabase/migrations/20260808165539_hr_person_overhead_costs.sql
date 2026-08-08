-- Person-attached overhead costs (desk, office share, utilities, etc.)
-- Distinct from compensation_records — these are resource carrying costs.

CREATE TABLE IF NOT EXISTS public.person_overhead_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  cost_category text NOT NULL
    CHECK (cost_category IN (
      'desk',
      'office_rent_share',
      'office_utilities',
      'equipment',
      'software_seat',
      'insurance',
      'travel_allowance',
      'other'
    )),
  label text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'one_off', 'n/a')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  accounting_ref_id text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS person_overhead_costs_person_id_idx
  ON public.person_overhead_costs (person_id);
CREATE INDEX IF NOT EXISTS person_overhead_costs_effective_idx
  ON public.person_overhead_costs (effective_from, effective_to);

COMMENT ON TABLE public.person_overhead_costs IS
  'Non-compensation carrying costs attached to a roster person (desk, office bills, seats, etc.).';

ALTER TABLE public.person_overhead_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access person_overhead_costs" ON public.person_overhead_costs;
CREATE POLICY "Admins full access person_overhead_costs"
  ON public.person_overhead_costs
  FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_overhead_costs
  TO authenticated, anon, service_role;

-- Fully-loaded person cost view (active monthly-ish overhead + current comp)
CREATE OR REPLACE VIEW public.hr_person_fully_loaded_cost
WITH (security_invoker = true)
AS
WITH active_overhead AS (
  SELECT
    person_id,
    SUM(
      CASE frequency
        WHEN 'monthly' THEN amount
        WHEN 'quarterly' THEN amount / 3.0
        WHEN 'yearly' THEN amount / 12.0
        WHEN 'one_off' THEN 0
        ELSE 0
      END
    ) AS monthly_overhead
  FROM public.person_overhead_costs
  WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE
  GROUP BY person_id
),
active_comp AS (
  SELECT DISTINCT ON (cr.person_id)
    cr.person_id,
    cr.comp_model,
    cr.amount,
    cr.currency,
    cr.frequency,
    CASE
      WHEN cr.comp_model = 'de_full_time_salary' AND sb.id IS NOT NULL THEN
        COALESCE(sb.gross_salary, 0)
        + COALESCE(sb.pension_employer, 0)
        + COALESCE(sb.unemployment_employer, 0)
        + COALESCE(sb.health_employer, 0)
        + COALESCE(sb.care_employer, 0)
        + COALESCE(sb.employer_surcharges, 0)
        + COALESCE(sb.accident_insurance, 0)
      WHEN cr.frequency = 'monthly' THEN COALESCE(cr.amount, 0)
      WHEN cr.frequency = 'per_hour' THEN NULL
      ELSE COALESCE(cr.amount, 0)
    END AS monthly_comp_estimate
  FROM public.compensation_records cr
  LEFT JOIN LATERAL (
    SELECT *
    FROM public.salary_breakdowns s
    WHERE s.compensation_record_id = cr.id
    ORDER BY s.period_year DESC NULLS LAST, s.period_month DESC NULLS LAST
    LIMIT 1
  ) sb ON true
  WHERE cr.effective_to IS NULL OR cr.effective_to >= CURRENT_DATE
  ORDER BY cr.person_id, cr.effective_from DESC
)
SELECT
  p.id AS person_id,
  p.full_name,
  et.key AS engagement_type_key,
  et.label AS engagement_type_label,
  p.hourly_rate_cost,
  COALESCE(c.monthly_comp_estimate, 0) AS monthly_compensation,
  COALESCE(o.monthly_overhead, 0) AS monthly_overhead,
  COALESCE(c.monthly_comp_estimate, 0) + COALESCE(o.monthly_overhead, 0) AS monthly_fully_loaded,
  c.comp_model,
  c.currency
FROM public.people p
LEFT JOIN public.engagement_types et ON et.id = p.engagement_type_id
LEFT JOIN active_comp c ON c.person_id = p.id
LEFT JOIN active_overhead o ON o.person_id = p.id
WHERE p.roster_status = 'active';

GRANT SELECT ON public.hr_person_fully_loaded_cost TO authenticated, anon, service_role;
