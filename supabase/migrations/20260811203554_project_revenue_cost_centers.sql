-- Project Cost / Revenue centers: line items + CRM-aligned accounting stages.
-- Prospect → unidentified · Lead → identified · Client (signed/completed) → actual

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_stage_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_stage_check
  CHECK (stage IS NULL OR stage IN ('prospect', 'lead', 'signed', 'completed'));

COMMENT ON COLUMN public.projects.stage IS
  'Accounting pillar: prospect→unidentified, lead→identified, signed/completed (client)→actual.';

CREATE TABLE IF NOT EXISTS public.project_cost_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT (CURRENT_DATE),
  category text NOT NULL DEFAULT 'Actual cost',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS project_cost_lines_project_idx
  ON public.project_cost_lines (project_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS public.project_revenue_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  entry_date date NOT NULL DEFAULT (CURRENT_DATE),
  category text NOT NULL DEFAULT 'Revenue',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS project_revenue_lines_project_idx
  ON public.project_revenue_lines (project_id, entry_date DESC);

ALTER TABLE public.project_cost_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_revenue_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access project_cost_lines" ON public.project_cost_lines;
CREATE POLICY "Admins full access project_cost_lines"
  ON public.project_cost_lines FOR ALL
  USING (public.get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "Admins full access project_revenue_lines" ON public.project_revenue_lines;
CREATE POLICY "Admins full access project_revenue_lines"
  ON public.project_revenue_lines FOR ALL
  USING (public.get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  WITH CHECK (public.get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_cost_lines
  TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_revenue_lines
  TO authenticated, anon, service_role;

-- Re-pillar auto project ledger rows whenever stage changes.
CREATE OR REPLACE FUNCTION public.migrate_project_ledger_to_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_pillar text;
  old_pillar text;
  rev_sum numeric := 0;
  cost_sum numeric := 0;
  n_rows integer := 0;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  new_pillar := CASE
    WHEN NEW.stage = 'prospect' THEN 'unidentified'
    WHEN NEW.stage = 'lead' THEN 'identified'
    ELSE 'actual'
  END;
  old_pillar := CASE
    WHEN OLD.stage = 'prospect' THEN 'unidentified'
    WHEN OLD.stage = 'lead' THEN 'identified'
    ELSE 'actual'
  END;

  IF new_pillar IS NOT DISTINCT FROM old_pillar THEN
    RETURN NEW;
  END IF;

  UPDATE public.ledger_entries
  SET
    pillar = new_pillar,
    moved_from_pillar = old_pillar,
    moved_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE project_id = NEW.id
    AND source = 'auto_project'
    AND pillar IS DISTINCT FROM new_pillar;

  GET DIAGNOSTICS n_rows = ROW_COUNT;

  IF n_rows > 0 THEN
    SELECT
      COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type = 'cost' THEN amount ELSE 0 END), 0)
    INTO rev_sum, cost_sum
    FROM public.ledger_entries
    WHERE project_id = NEW.id
      AND source = 'auto_project'
      AND moved_at >= timezone('utc'::text, now()) - interval '1 minute';

    INSERT INTO public.ledger_activity (
      event_type, project_id, message, revenue_amount, cost_amount, meta
    ) VALUES (
      'pillar_migration',
      NEW.id,
      format(
        'Project %s stage %s→%s — €%s revenue, €%s cost moved to %s.',
        COALESCE(NEW.title, NEW.id::text),
        OLD.stage,
        NEW.stage,
        to_char(COALESCE(rev_sum, 0), 'FM999999990.00'),
        to_char(COALESCE(cost_sum, 0), 'FM999999990.00'),
        new_pillar
      ),
      rev_sum,
      cost_sum,
      jsonb_build_object(
        'from_stage', OLD.stage,
        'to_stage', NEW.stage,
        'from_pillar', old_pillar,
        'to_pillar', new_pillar,
        'rows', n_rows
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
