-- =============================================================================
-- WIDE OS — Account expansion (client proposals) + client requests + kickoff phase
-- Migration: 011_client_proposals_expansion.sql
-- =============================================================================

ALTER TABLE public.client_delivery_gates
  ADD COLUMN IF NOT EXISTS current_kickoff_phase TEXT NOT NULL DEFAULT 'phase-1-discovery'
  CHECK (current_kickoff_phase IN (
    'phase-1-discovery',
    'phase-2-creative',
    'phase-3-alignment',
    'phase-4-systems',
    'phase-5-lifecycle'
  ));

COMMENT ON COLUMN public.client_delivery_gates.current_kickoff_phase IS
  'Client journey position for the 5-phase stepper UI.';

-- ---------------------------------------------------------------------------
-- Client expansion proposals (CM upsells)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_proposals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                       TEXT NOT NULL,
  description                 TEXT,
  estimated_value             NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status                      TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'published', 'accepted', 'declined')),
  recommended_headline        TEXT,
  show_on_dashboard           BOOLEAN NOT NULL DEFAULT false,
  published_at                TIMESTAMPTZ,
  created_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_proposals_client_status
  ON public.client_proposals(client_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Client requests (dashboard action center)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'in_progress', 'closed')),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_requests_client
  ON public.client_requests(client_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Finance identified: link expansion proposals
-- ---------------------------------------------------------------------------
ALTER TABLE public.finance_identified_revenues
  ADD COLUMN IF NOT EXISTS client_proposal_id UUID REFERENCES public.client_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revenue_source TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_identified_client_proposal
  ON public.finance_identified_revenues(client_proposal_id)
  WHERE client_proposal_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Sync proposal → identified revenue (Expansion Revenue)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_client_proposal_to_finance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_quote TEXT;
  v_fid UUID;
BEGIN
  IF NEW.status NOT IN ('draft', 'published') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(company_name), ''), NULLIF(TRIM(full_name), ''), 'Client')
  INTO v_client_name
  FROM public.profiles
  WHERE id = NEW.client_id;

  v_quote := 'EXP-' || LEFT(REPLACE(NEW.id::text, '-', ''), 8);

  SELECT id INTO v_fid
  FROM public.finance_identified_revenues
  WHERE client_proposal_id = NEW.id;

  IF v_fid IS NOT NULL THEN
    UPDATE public.finance_identified_revenues
    SET
      client_name = v_client_name,
      project_name = NEW.title,
      quote_number = v_quote,
      amount = NEW.estimated_value,
      revenue_source = 'Expansion Revenue',
      notes = COALESCE(NEW.description, ''),
      updated_at = now()
    WHERE id = v_fid;
  ELSE
    INSERT INTO public.finance_identified_revenues (
      client_proposal_id,
      client_name,
      project_name,
      quote_number,
      date_sent,
      assumed_processed_date,
      recurrence,
      amount,
      revenue_source,
      notes,
      created_by
    )
    VALUES (
      NEW.id,
      v_client_name,
      NEW.title,
      v_quote,
      CURRENT_DATE,
      (CURRENT_DATE + INTERVAL '30 days')::date,
      'one_time',
      NEW.estimated_value,
      'Expansion Revenue',
      COALESCE(NEW.description, ''),
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_client_proposal_finance ON public.client_proposals;
CREATE TRIGGER sync_client_proposal_finance
  AFTER INSERT OR UPDATE OF title, description, estimated_value, status, client_id
  ON public.client_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_proposal_to_finance();

DROP TRIGGER IF EXISTS set_client_proposals_updated_at ON public.client_proposals;
CREATE TRIGGER set_client_proposals_updated_at
  BEFORE UPDATE ON public.client_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_client_requests_updated_at ON public.client_requests;
CREATE TRIGGER set_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full client_proposals" ON public.client_proposals;
DROP POLICY IF EXISTS "CM manage assigned client_proposals" ON public.client_proposals;
DROP POLICY IF EXISTS "Clients read published client_proposals" ON public.client_proposals;

CREATE POLICY "Superadmin full client_proposals"
  ON public.client_proposals FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned client_proposals"
  ON public.client_proposals FOR ALL
  USING (public.is_client_manager() AND public.can_access_client(client_id))
  WITH CHECK (public.is_client_manager() AND public.can_access_client(client_id));

CREATE POLICY "Clients read published client_proposals"
  ON public.client_proposals FOR SELECT
  USING (
    public.get_user_role() = 'client'
    AND public.effective_client_id() = client_id
    AND status = 'published'
  );

DROP POLICY IF EXISTS "Superadmin full client_requests" ON public.client_requests;
DROP POLICY IF EXISTS "CM read assigned client_requests" ON public.client_requests;
DROP POLICY IF EXISTS "Clients manage own client_requests" ON public.client_requests;

CREATE POLICY "Superadmin full client_requests"
  ON public.client_requests FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "CM read assigned client_requests"
  ON public.client_requests FOR SELECT
  USING (public.is_client_manager() AND public.can_access_client(client_id));

CREATE POLICY "Clients manage own client_requests"
  ON public.client_requests FOR ALL
  USING (
    public.get_user_role() = 'client'
    AND public.effective_client_id() = client_id
  )
  WITH CHECK (
    public.get_user_role() = 'client'
    AND public.effective_client_id() = client_id
  );

GRANT ALL ON TABLE public.client_proposals TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_requests TO postgres, anon, authenticated, service_role;
