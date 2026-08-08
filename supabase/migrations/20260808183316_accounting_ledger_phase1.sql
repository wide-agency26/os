-- Accounting Phase 1: ledger, cash balance, project stage/deal_value, auto migration trigger.
-- company_id / client_id both reference crm_customers (no separate companies/clients tables).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage text;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_stage_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_stage_check
  CHECK (stage IS NULL OR stage IN ('prospect', 'signed', 'completed'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deal_value numeric;

COMMENT ON COLUMN public.projects.stage IS
  'Accounting pillar driver: prospect→identified, signed/completed→actual.';
COMMENT ON COLUMN public.projects.deal_value IS
  'Signed/prospect deal value used for auto revenue ledger rows.';

UPDATE public.projects
SET stage = CASE
  WHEN status = 'completed' THEN 'completed'
  ELSE 'signed'
END
WHERE stage IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN stage SET DEFAULT 'prospect';

UPDATE public.projects SET stage = 'prospect' WHERE stage IS NULL;
ALTER TABLE public.projects ALTER COLUMN stage SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar text NOT NULL
    CHECK (pillar IN ('actual', 'identified', 'unidentified')),
  type text NOT NULL
    CHECK (type IN ('revenue', 'cost')),
  amount numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL,
  company_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN (
      'manual',
      'auto_project',
      'auto_hr',
      'auto_overhead',
      'auto_lexware'
    )),
  sync_key text UNIQUE,
  moved_from_pillar text
    CHECK (moved_from_pillar IS NULL OR moved_from_pillar IN ('actual', 'identified', 'unidentified')),
  moved_at timestamptz,
  confidence text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS ledger_entries_pillar_date_idx
  ON public.ledger_entries (pillar, entry_date);
CREATE INDEX IF NOT EXISTS ledger_entries_project_id_idx
  ON public.ledger_entries (project_id);
CREATE INDEX IF NOT EXISTS ledger_entries_company_id_idx
  ON public.ledger_entries (company_id);
CREATE INDEX IF NOT EXISTS ledger_entries_source_idx
  ON public.ledger_entries (source);
CREATE INDEX IF NOT EXISTS ledger_entries_type_idx
  ON public.ledger_entries (type);

CREATE TABLE IF NOT EXISTS public.cash_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_lexware')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_balance_entries_date_source_uidx
  ON public.cash_balance_entries (balance_date, source);

CREATE TABLE IF NOT EXISTS public.ledger_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  message text NOT NULL,
  revenue_amount numeric,
  cost_amount numeric,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS ledger_activity_created_idx
  ON public.ledger_activity (created_at DESC);

CREATE OR REPLACE FUNCTION public.migrate_project_ledger_to_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rev_sum numeric := 0;
  cost_sum numeric := 0;
  n_rows integer := 0;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  IF OLD.stage = 'prospect' AND NEW.stage IN ('signed', 'completed') THEN
    UPDATE public.ledger_entries
    SET
      pillar = 'actual',
      moved_from_pillar = 'identified',
      moved_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
    WHERE project_id = NEW.id
      AND pillar = 'identified';

    GET DIAGNOSTICS n_rows = ROW_COUNT;

    IF n_rows > 0 THEN
      SELECT
        COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0)
      INTO rev_sum, cost_sum
      FROM public.ledger_entries
      WHERE project_id = NEW.id
        AND moved_from_pillar = 'identified'
        AND moved_at IS NOT NULL
        AND moved_at >= timezone('utc'::text, now()) - interval '1 minute';

      INSERT INTO public.ledger_activity (
        event_type, project_id, message, revenue_amount, cost_amount, meta
      ) VALUES (
        'pillar_migration',
        NEW.id,
        format(
          'Project %s moved to Actual — €%s revenue, €%s cost reassigned.',
          COALESCE(NEW.title, NEW.id::text),
          to_char(COALESCE(rev_sum, 0), 'FM999999990.00'),
          to_char(COALESCE(cost_sum, 0), 'FM999999990.00')
        ),
        rev_sum,
        cost_sum,
        jsonb_build_object(
          'from_stage', OLD.stage,
          'to_stage', NEW.stage,
          'rows', n_rows
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_ledger_pillar_migration ON public.projects;
CREATE TRIGGER trg_projects_ledger_pillar_migration
  AFTER UPDATE OF stage ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.migrate_project_ledger_to_actual();

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_balance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access ledger_entries" ON public.ledger_entries;
CREATE POLICY "Admins full access ledger_entries"
  ON public.ledger_entries FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "Admins full access cash_balance_entries" ON public.cash_balance_entries;
CREATE POLICY "Admins full access cash_balance_entries"
  ON public.cash_balance_entries FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "Admins full access ledger_activity" ON public.ledger_activity;
CREATE POLICY "Admins full access ledger_activity"
  ON public.ledger_activity FOR ALL
  USING (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries
  TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_balance_entries
  TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_activity
  TO authenticated, anon, service_role;
