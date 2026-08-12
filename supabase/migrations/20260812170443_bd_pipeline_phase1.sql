-- =============================================================================
-- BD Pipeline Phase 1 — BD Records board + intake (no delete; archive only)
-- Full record shape for later phases; Phase 1 UI uses core fields + timeline.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bd_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact / company (manual intake)
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  position TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,

  -- Optional link into CRM company spine (handoff later; Phase 1 optional)
  company_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,

  -- Source
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_discovered')),
  discovery_method TEXT,

  -- Pipeline stage (9 main + 3 side lanes)
  stage TEXT NOT NULL DEFAULT 'prospect'
    CHECK (stage IN (
      'prospect',
      'qualifying',
      'qualified_lead',
      'outreach',
      'discovery_call',
      'proposal_sent',
      'contract',
      'quotation',
      'client_won',
      'on_hold',
      'declined',
      'archived'
    )),
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ownership
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  observer_ids UUID[] NOT NULL DEFAULT '{}',

  -- Qualification (Phase 2 shell fields ready)
  legitimacy_status TEXT
    CHECK (legitimacy_status IS NULL OR legitimacy_status IN ('pass', 'fail', 'uncertain')),
  legitimacy_reason TEXT,
  demand_signals JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Audit / outreach / discovery / commercial (later phases; structured JSON)
  audit_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  outreach_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  discovery_call JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
  contract JSONB NOT NULL DEFAULT '{}'::jsonb,
  quotation JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Soft-remove only (never hard-delete)
  archived_reason TEXT,

  -- Board helpers
  next_action_due DATE,
  next_action_label TEXT,
  sort_order INT NOT NULL DEFAULT 0,

  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bd_records_stage_idx ON public.bd_records (stage);
CREATE INDEX IF NOT EXISTS bd_records_owner_idx ON public.bd_records (owner_id);
CREATE INDEX IF NOT EXISTS bd_records_company_id_idx ON public.bd_records (company_id);
CREATE INDEX IF NOT EXISTS bd_records_source_idx ON public.bd_records (source);
CREATE INDEX IF NOT EXISTS bd_records_legitimacy_idx ON public.bd_records (legitimacy_status);

-- Append-only timeline (no UPDATE/DELETE from app; RLS blocks DELETE)
CREATE TABLE IF NOT EXISTS public.bd_timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bd_record_id UUID NOT NULL REFERENCES public.bd_records(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL DEFAULT 'user'
    CHECK (actor_type IN ('system', 'user')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  note TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bd_timeline_record_idx
  ON public.bd_timeline_entries (bd_record_id, created_at DESC);

-- Hard rule: no DELETE on bd_records (archive instead)
CREATE OR REPLACE FUNCTION public.bd_records_forbid_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'bd_records cannot be deleted — archive the record instead';
END;
$$;

DROP TRIGGER IF EXISTS bd_records_no_delete ON public.bd_records;
CREATE TRIGGER bd_records_no_delete
  BEFORE DELETE ON public.bd_records
  FOR EACH ROW
  EXECUTE FUNCTION public.bd_records_forbid_delete();

-- Touch updated_at
CREATE OR REPLACE FUNCTION public.bd_records_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bd_records_updated_at ON public.bd_records;
CREATE TRIGGER bd_records_updated_at
  BEFORE UPDATE ON public.bd_records
  FOR EACH ROW
  EXECUTE FUNCTION public.bd_records_set_updated_at();

ALTER TABLE public.bd_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_timeline_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.bd_records TO authenticated;
-- intentionally no DELETE grant
REVOKE DELETE ON public.bd_records FROM authenticated;
REVOKE DELETE ON public.bd_records FROM anon;

GRANT SELECT, INSERT ON public.bd_timeline_entries TO authenticated;
REVOKE UPDATE, DELETE ON public.bd_timeline_entries FROM authenticated;
REVOKE UPDATE, DELETE ON public.bd_timeline_entries FROM anon;

DROP POLICY IF EXISTS "Staff manage bd_records" ON public.bd_records;
CREATE POLICY "Staff manage bd_records"
  ON public.bd_records
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Staff read bd_timeline" ON public.bd_timeline_entries;
CREATE POLICY "Staff read bd_timeline"
  ON public.bd_timeline_entries
  FOR SELECT TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

DROP POLICY IF EXISTS "Staff insert bd_timeline" ON public.bd_timeline_entries;
CREATE POLICY "Staff insert bd_timeline"
  ON public.bd_timeline_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager', 'hr_manager'));

NOTIFY pgrst, 'reload schema';
