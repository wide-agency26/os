-- =============================================================================
-- WIDE OS — BD prospects, client kickoff gates, extended roles
-- Migration: 007_prospects_kickoff_roles.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles: bd_manager, hr_manager
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN (
    'superadmin',
    'accountant',
    'bd_manager',
    'client_manager',
    'client',
    'prospect',
    'hr_manager'
  ));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prospect_id UUID;

-- FK added after prospects table exists
-- ---------------------------------------------------------------------------
-- Prospects (BD pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  status        TEXT NOT NULL DEFAULT 'lead'
                CHECK (status IN ('lead', 'qualified', 'proposal', 'won', 'lost')),
  lead_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_lead_admin ON public.prospects(lead_admin_id);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_prospect_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_prospect_id_fkey
  FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_prospect_id ON public.profiles(prospect_id);

-- ---------------------------------------------------------------------------
-- Prospect proposals (BD workspace → prospect portal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prospect_proposals (
  prospect_id        UUID PRIMARY KEY REFERENCES public.prospects(id) ON DELETE CASCADE,
  title              TEXT NOT NULL DEFAULT 'Partnership proposal',
  executive_summary  TEXT,
  scope_sections     JSONB NOT NULL DEFAULT '[]'::jsonb,
  timeline           JSONB NOT NULL DEFAULT '[]'::jsonb,
  investment         JSONB NOT NULL DEFAULT '{}'::jsonb,
  sow_draft          TEXT,
  is_published       BOOLEAN NOT NULL DEFAULT false,
  published_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.prospect_proposals.scope_sections IS
  '[{ "heading": string, "body": string }]';

-- ---------------------------------------------------------------------------
-- Client delivery gates (5-phase kickoff + creative routes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_delivery_gates (
  client_id                   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  creative_routes             JSONB NOT NULL DEFAULT '[]'::jsonb,
  phase_3_selected_route_id   TEXT,
  phase_3_alignment_signed_at TIMESTAMPTZ,
  phase_3_signed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.client_delivery_gates.creative_routes IS
  '[{ "id": string, "name": string, "logic": string, "tone": string, "creative": string, "execution": string }]';

DROP TRIGGER IF EXISTS set_prospects_updated_at ON public.prospects;
CREATE TRIGGER set_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_prospect_proposals_updated_at ON public.prospect_proposals;
CREATE TRIGGER set_prospect_proposals_updated_at
  BEFORE UPDATE ON public.prospect_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_client_delivery_gates_updated_at ON public.client_delivery_gates;
CREATE TRIGGER set_client_delivery_gates_updated_at
  BEFORE UPDATE ON public.client_delivery_gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_bd_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role(), '') IN ('superadmin', 'admin', 'bd_manager');
$$;

CREATE OR REPLACE FUNCTION public.can_access_prospect(target_prospect_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_prospect_id IS NULL THEN false
    WHEN public.is_superadmin() THEN true
    WHEN public.get_user_role() = 'bd_manager' THEN (
      EXISTS (
        SELECT 1 FROM public.prospects p
        WHERE p.id = target_prospect_id
          AND (p.lead_admin_id = auth.uid() OR p.lead_admin_id IS NULL)
      )
    )
    WHEN public.get_user_role() = 'prospect' THEN (
      EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.prospect_id = target_prospect_id
      )
    )
    ELSE false
  END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: prospects
-- ---------------------------------------------------------------------------
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_delivery_gates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full prospects" ON public.prospects;
CREATE POLICY "Superadmin full prospects"
  ON public.prospects FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "BD staff manage prospects" ON public.prospects;
CREATE POLICY "BD staff manage prospects"
  ON public.prospects FOR ALL
  USING (public.is_bd_staff())
  WITH CHECK (public.is_bd_staff());

DROP POLICY IF EXISTS "Prospect read own row" ON public.prospects;
CREATE POLICY "Prospect read own row"
  ON public.prospects FOR SELECT
  USING (
    public.get_user_role() = 'prospect'
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.prospect_id = prospects.id
    )
  );

DROP POLICY IF EXISTS "Superadmin full prospect_proposals" ON public.prospect_proposals;
CREATE POLICY "Superadmin full prospect_proposals"
  ON public.prospect_proposals FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "BD staff manage prospect_proposals" ON public.prospect_proposals;
CREATE POLICY "BD staff manage prospect_proposals"
  ON public.prospect_proposals FOR ALL
  USING (
    public.is_bd_staff()
    AND public.can_access_prospect(prospect_id)
  )
  WITH CHECK (
    public.is_bd_staff()
    AND public.can_access_prospect(prospect_id)
  );

DROP POLICY IF EXISTS "Prospect read published proposal" ON public.prospect_proposals;
CREATE POLICY "Prospect read published proposal"
  ON public.prospect_proposals FOR SELECT
  USING (
    is_published = true
    AND public.can_access_prospect(prospect_id)
  );

DROP POLICY IF EXISTS "Superadmin full client_delivery_gates" ON public.client_delivery_gates;
CREATE POLICY "Superadmin full client_delivery_gates"
  ON public.client_delivery_gates FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "CM manage assigned delivery gates" ON public.client_delivery_gates;
CREATE POLICY "CM manage assigned delivery gates"
  ON public.client_delivery_gates FOR ALL
  USING (
    public.is_client_manager() AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.is_client_manager() AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS "Clients read own delivery gates" ON public.client_delivery_gates;
CREATE POLICY "Clients read own delivery gates"
  ON public.client_delivery_gates FOR SELECT
  USING (client_id = public.effective_client_id());

DROP POLICY IF EXISTS "Clients sign off phase 3" ON public.client_delivery_gates;
CREATE POLICY "Clients sign off phase 3"
  ON public.client_delivery_gates FOR UPDATE
  USING (client_id = public.effective_client_id())
  WITH CHECK (client_id = public.effective_client_id());

GRANT ALL ON TABLE public.prospects TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.prospect_proposals TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_delivery_gates TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.can_access_prospect(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_bd_staff() TO authenticated;
