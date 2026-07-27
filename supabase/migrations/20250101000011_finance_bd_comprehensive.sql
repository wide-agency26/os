-- =============================================================================
-- WIDE OS — Comprehensive Finance ledger + BD extensions
-- Migration: 010_finance_bd_comprehensive.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Prospects: extended fields + journey statuses
-- ---------------------------------------------------------------------------
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS value_amount NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS possible_start_date DATE,
  ADD COLUMN IF NOT EXISTS duration_months INT,
  ADD COLUMN IF NOT EXISTS services TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.prospects SET status = 'prospect' WHERE status = 'qualified';
UPDATE public.prospects SET status = 'accepted' WHERE status = 'won';

ALTER TABLE public.prospects DROP CONSTRAINT IF EXISTS prospects_status_check;
ALTER TABLE public.prospects
  ADD CONSTRAINT prospects_status_check
  CHECK (status IN (
    'lead', 'prospect', 'proposal', 'final_nego', 'agreement', 'accepted', 'lost'
  ));

-- ---------------------------------------------------------------------------
-- Prospect budget line items (BD → Identified P&L costs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_budget_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  paid_for        TEXT NOT NULL,
  project_name    TEXT,
  quote_number    TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Finance: Actual P&L
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_actual_revenues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name     TEXT NOT NULL,
  project_name    TEXT,
  invoice_ref     TEXT,
  date_sent       DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_actual_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paid_for        TEXT NOT NULL,
  project_name    TEXT,
  invoice_ref     TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Finance: Identified P&L (pipeline / quotes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_identified_revenues (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id           UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  client_name           TEXT NOT NULL,
  project_name          TEXT,
  quote_number          TEXT,
  date_sent             DATE,
  assumed_processed_date DATE,
  recurrence            TEXT NOT NULL DEFAULT 'one_time'
                        CHECK (recurrence IN ('one_time', 'recurring')),
  amount                NUMERIC(14, 2) NOT NULL,
  notes                 TEXT,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_identified_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  paid_for        TEXT NOT NULL,
  project_name    TEXT,
  quote_number    TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Finance: Unidentified / projected P&L
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_unidentified_revenues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name     TEXT NOT NULL,
  project_name    TEXT,
  months_label    TEXT NOT NULL,
  recurrence      TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_unidentified_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  will_pay_for    TEXT NOT NULL,
  project_name    TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time'
                  CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- BD: Partnerships & marketing tasks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bd_partnerships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_or_person TEXT NOT NULL,
  forecasted_value  NUMERIC(14, 2),
  duration_months   INT,
  start_date        DATE,
  status            TEXT NOT NULL DEFAULT 'exploring'
                    CHECK (status IN ('exploring', 'active', 'paused', 'completed')),
  notes             TEXT,
  lead_admin_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bd_marketing_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  due_date      DATE,
  category      TEXT DEFAULT 'general',
  assignee_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'prospect_budget_costs', 'finance_actual_revenues', 'finance_actual_costs',
    'finance_identified_revenues', 'finance_identified_costs',
    'finance_unidentified_revenues', 'finance_unidentified_costs',
    'bd_partnerships', 'bd_marketing_tasks'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_finance_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role(), '') IN ('superadmin', 'admin', 'accountant');
$$;

-- ---------------------------------------------------------------------------
-- RLS policies (finance staff full access; BD staff on prospect budgets)
-- ---------------------------------------------------------------------------
ALTER TABLE public.prospect_budget_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_actual_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_actual_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_identified_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_identified_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_unidentified_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_unidentified_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_marketing_tasks ENABLE ROW LEVEL SECURITY;

-- Finance tables
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'finance_actual_revenues', 'finance_actual_costs',
    'finance_identified_revenues', 'finance_identified_costs',
    'finance_unidentified_revenues', 'finance_unidentified_costs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Finance staff full %s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Finance staff full %s" ON public.%I FOR ALL USING (public.is_finance_staff()) WITH CHECK (public.is_finance_staff())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Prospect budgets: BD + finance
DROP POLICY IF EXISTS "BD and finance manage prospect budgets" ON public.prospect_budget_costs;
CREATE POLICY "BD and finance manage prospect budgets"
  ON public.prospect_budget_costs FOR ALL
  USING (public.is_bd_staff() OR public.is_finance_staff())
  WITH CHECK (
    (public.is_bd_staff() AND public.can_access_prospect(prospect_id))
    OR public.is_finance_staff()
  );

-- Partnerships
DROP POLICY IF EXISTS "BD staff partnerships" ON public.bd_partnerships;
CREATE POLICY "BD staff partnerships"
  ON public.bd_partnerships FOR ALL
  USING (public.is_bd_staff() OR public.is_superadmin())
  WITH CHECK (public.is_bd_staff() OR public.is_superadmin());

-- Marketing tasks
DROP POLICY IF EXISTS "BD staff marketing tasks" ON public.bd_marketing_tasks;
CREATE POLICY "BD staff marketing tasks"
  ON public.bd_marketing_tasks FOR ALL
  USING (public.is_bd_staff() OR public.is_superadmin())
  WITH CHECK (public.is_bd_staff() OR public.is_superadmin());

GRANT ALL ON TABLE public.prospect_budget_costs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance_actual_revenues TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance_actual_costs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance_identified_revenues TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance_identified_costs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance_unidentified_revenues TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.finance_unidentified_costs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.bd_partnerships TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.bd_marketing_tasks TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_finance_staff() TO authenticated;
