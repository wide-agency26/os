-- =============================================================================
-- Restore operational tables after workspace reset (017)
-- Keeps workspaces as the pipeline source of truth; restores finance ledgers,
-- brand hubs, kickoff gates, BD, vault, and client portal tables.
-- =============================================================================

-- ---- Core portal tables -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_hubs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_colors        JSONB DEFAULT '[]'::jsonb,
  typography          JSONB DEFAULT '{}'::jsonb,
  logo_url            TEXT,
  guideline_document  JSONB,
  guideline_source_path TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

CREATE TABLE IF NOT EXISTS public.projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  scope             TEXT,
  status            TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'expired', 'completed')),
  start_date        DATE,
  end_date          DATE,
  contract_renews_at DATE,
  launch_date       DATE,
  lead_admin_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);

-- ---- BD pipeline (linked to workspaces) ------------------------------------
CREATE TABLE IF NOT EXISTS public.prospects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  company_name        TEXT NOT NULL,
  contact_name        TEXT,
  contact_email       TEXT,
  status              TEXT NOT NULL DEFAULT 'lead'
                      CHECK (status IN (
                        'lead', 'prospect', 'proposal', 'final_nego', 'agreement', 'accepted', 'lost'
                      )),
  project_name        TEXT,
  value_amount        NUMERIC(14, 2),
  possible_start_date DATE,
  duration_months     INT,
  services            TEXT,
  description         TEXT,
  links               JSONB NOT NULL DEFAULT '[]'::jsonb,
  client_profile_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_admin_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_workspace ON public.prospects(workspace_id) WHERE workspace_id IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS public.prospect_budget_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  paid_for        TEXT NOT NULL,
  project_name    TEXT,
  quote_number    TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bd_partnerships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
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

-- ---- Finance ledger ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_actual_revenues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL,
  project_name    TEXT,
  invoice_ref     TEXT,
  date_sent       DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_actual_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  paid_for        TEXT NOT NULL,
  project_name    TEXT,
  invoice_ref     TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_identified_revenues (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  prospect_id            UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  client_name            TEXT NOT NULL,
  project_name           TEXT,
  quote_number           TEXT,
  date_sent              DATE,
  assumed_processed_date DATE,
  recurrence             TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount                 NUMERIC(14, 2) NOT NULL,
  notes                  TEXT,
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_identified_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  prospect_id     UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  paid_for        TEXT NOT NULL,
  project_name    TEXT,
  quote_number    TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_unidentified_revenues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  client_name     TEXT NOT NULL,
  project_name    TEXT,
  months_label    TEXT NOT NULL,
  recurrence      TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_unidentified_costs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  will_pay_for    TEXT NOT NULL,
  project_name    TEXT,
  date_received   DATE,
  date_processed  DATE,
  recurrence      TEXT NOT NULL DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'recurring')),
  amount          NUMERIC(14, 2) NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Kickoff gates ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_delivery_gates (
  client_id                   UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  creative_routes             JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_kickoff_phase       TEXT NOT NULL DEFAULT 'phase-1-discovery'
    CHECK (current_kickoff_phase IN (
      'phase-1-discovery', 'phase-2-creative', 'phase-3-alignment',
      'phase-4-systems', 'phase-5-lifecycle'
    )),
  phase_3_selected_route_id   TEXT,
  phase_3_alignment_signed_at TIMESTAMPTZ,
  phase_3_signed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Client portal extensions -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_proposals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id         UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  estimated_value      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'published', 'accepted', 'declined')),
  recommended_headline TEXT,
  show_on_dashboard    BOOLEAN NOT NULL DEFAULT false,
  published_at         TIMESTAMPTZ,
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject                 TEXT NOT NULL,
  body                    TEXT NOT NULL DEFAULT '',
  status                  TEXT NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'in_progress', 'closed')),
  service                 TEXT,
  form_answers            JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_response_date DATE,
  response_note           TEXT,
  responded_at            TIMESTAMPTZ,
  responded_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vault_files (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id         UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  storage_path         TEXT NOT NULL,
  original_filename    TEXT NOT NULL,
  mime_type            TEXT,
  size_bytes           BIGINT,
  uploaded_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vault_downloads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id       UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.web_style_guide_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                   TEXT NOT NULL,
  component_kind          TEXT NOT NULL DEFAULT 'component',
  screenshot_storage_path TEXT,
  staging_url             TEXT,
  why_notes               TEXT,
  dos                     TEXT,
  donts                   TEXT,
  sort_order              INT NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.web_style_guide_snapshots (
  client_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_class            TEXT NOT NULL DEFAULT '',
  html_fragment         TEXT NOT NULL DEFAULT '',
  stylesheet_hrefs      JSONB NOT NULL DEFAULT '[]'::jsonb,
  inline_head_styles    TEXT NOT NULL DEFAULT '',
  style_guide_document  JSONB,
  pdf_notes             TEXT,
  source_filename       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portal_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,
  summary     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.global_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body       TEXT NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_email  BOOLEAN NOT NULL DEFAULT true,
  notify_sms    BOOLEAN NOT NULL DEFAULT false,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- updated_at helper ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---- Finance staff helper (if missing) --------------------------------------
CREATE OR REPLACE FUNCTION public.is_finance_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role(), '') IN ('superadmin', 'admin', 'accountant');
$$;

-- ---- RLS: finance tables ----------------------------------------------------
ALTER TABLE public.finance_actual_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_actual_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_identified_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_identified_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_unidentified_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_unidentified_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_budget_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_marketing_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_delivery_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_style_guide_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_style_guide_snapshots ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Superadmin brand hubs" ON public.brand_hubs;
CREATE POLICY "Superadmin brand hubs" ON public.brand_hubs
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Client read own brand hub" ON public.brand_hubs;
CREATE POLICY "Client read own brand hub" ON public.brand_hubs
  FOR SELECT USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Superadmin projects" ON public.projects;
CREATE POLICY "Superadmin projects" ON public.projects
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Client read own projects" ON public.projects;
CREATE POLICY "Client read own projects" ON public.projects
  FOR SELECT USING (client_id = auth.uid());

DROP POLICY IF EXISTS "BD prospects" ON public.prospects;
CREATE POLICY "BD prospects" ON public.prospects
  FOR ALL USING (public.is_superadmin() OR public.is_bd_staff())
  WITH CHECK (public.is_superadmin() OR public.is_bd_staff());

DROP POLICY IF EXISTS "Kickoff gates" ON public.client_delivery_gates;
CREATE POLICY "Kickoff gates" ON public.client_delivery_gates
  FOR ALL USING (public.is_superadmin() OR public.can_access_client(client_id))
  WITH CHECK (public.is_superadmin() OR public.can_access_client(client_id));

DROP POLICY IF EXISTS "Client delivery gates self" ON public.client_delivery_gates;
CREATE POLICY "Client delivery gates self" ON public.client_delivery_gates
  FOR SELECT USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Web style guide snapshots" ON public.web_style_guide_snapshots;
CREATE POLICY "Web style guide snapshots" ON public.web_style_guide_snapshots
  FOR ALL USING (public.is_superadmin() OR public.can_access_client(client_id))
  WITH CHECK (public.is_superadmin() OR public.can_access_client(client_id));

-- ---- Client manager tables (dropped in 016) ---------------------------------
CREATE TABLE IF NOT EXISTS public.client_manager_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (manager_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_assignments_manager ON public.client_manager_assignments(manager_id);
CREATE INDEX IF NOT EXISTS idx_cm_assignments_client ON public.client_manager_assignments(client_id);

CREATE TABLE IF NOT EXISTS public.client_manager_profiles (
  user_id                     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title                   TEXT,
  bio                         TEXT,
  public_email                TEXT,
  phone                       TEXT,
  google_calendar_meeting_url TEXT,
  linkedin_url                TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_manager_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin manage cm assignments" ON public.client_manager_assignments;
CREATE POLICY "Superadmin manage cm assignments"
  ON public.client_manager_assignments FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "CM read own assignments" ON public.client_manager_assignments;
CREATE POLICY "CM read own assignments"
  ON public.client_manager_assignments FOR SELECT
  USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "Superadmin full cm profiles" ON public.client_manager_profiles;
CREATE POLICY "Superadmin full cm profiles"
  ON public.client_manager_profiles FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "CM manage own profile" ON public.client_manager_profiles;
CREATE POLICY "CM manage own profile"
  ON public.client_manager_profiles FOR ALL
  USING (user_id = auth.uid() AND public.is_client_manager())
  WITH CHECK (user_id = auth.uid() AND public.is_client_manager());

DROP POLICY IF EXISTS "Clients read assigned cm profiles" ON public.client_manager_profiles;
CREATE POLICY "Clients read assigned cm profiles"
  ON public.client_manager_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_manager_assignments a
      WHERE a.manager_id = client_manager_profiles.user_id
        AND a.client_id = public.effective_client_id()
    )
  );

DROP POLICY IF EXISTS "Agency staff read cm profiles" ON public.client_manager_profiles;
CREATE POLICY "Agency staff read cm profiles"
  ON public.client_manager_profiles FOR SELECT
  USING (public.is_agency_staff());

-- ---- Finance expansion link (012) -------------------------------------------
ALTER TABLE public.finance_identified_revenues
  ADD COLUMN IF NOT EXISTS client_proposal_id UUID REFERENCES public.client_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revenue_source TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_identified_client_proposal
  ON public.finance_identified_revenues(client_proposal_id)
  WHERE client_proposal_id IS NOT NULL;

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
      created_by,
      workspace_id
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
      NEW.created_by,
      NEW.workspace_id
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

-- ---- updated_at triggers on restored tables ---------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'brand_hubs', 'projects', 'prospects', 'prospect_proposals', 'prospect_budget_costs',
    'bd_partnerships', 'bd_marketing_tasks',
    'finance_actual_revenues', 'finance_actual_costs',
    'finance_identified_revenues', 'finance_identified_costs',
    'finance_unidentified_revenues', 'finance_unidentified_costs',
    'client_proposals', 'client_requests', 'web_style_guide_items', 'web_style_guide_snapshots',
    'client_manager_profiles'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ---- Portal / vault / announcements RLS -------------------------------------
ALTER TABLE public.prospect_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BD and finance manage prospect budgets" ON public.prospect_budget_costs;
CREATE POLICY "BD and finance manage prospect budgets"
  ON public.prospect_budget_costs FOR ALL
  USING (public.is_bd_staff() OR public.is_finance_staff())
  WITH CHECK (
    (public.is_bd_staff() AND public.can_access_prospect(prospect_id))
    OR public.is_finance_staff()
  );

DROP POLICY IF EXISTS "Superadmin full prospect_proposals" ON public.prospect_proposals;
CREATE POLICY "Superadmin full prospect_proposals"
  ON public.prospect_proposals FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "BD staff manage prospect_proposals" ON public.prospect_proposals;
CREATE POLICY "BD staff manage prospect_proposals"
  ON public.prospect_proposals FOR ALL
  USING (public.is_bd_staff() AND public.can_access_prospect(prospect_id))
  WITH CHECK (public.is_bd_staff() AND public.can_access_prospect(prospect_id));

DROP POLICY IF EXISTS "Superadmin full client_proposals" ON public.client_proposals;
DROP POLICY IF EXISTS "CM manage assigned client_proposals" ON public.client_proposals;
DROP POLICY IF EXISTS "Clients read published client_proposals" ON public.client_proposals;

CREATE POLICY "Superadmin full client_proposals"
  ON public.client_proposals FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

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
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "CM read assigned client_requests"
  ON public.client_requests FOR SELECT
  USING (public.is_client_manager() AND public.can_access_client(client_id));

CREATE POLICY "Clients manage own client_requests"
  ON public.client_requests FOR ALL
  USING (public.get_user_role() = 'client' AND public.effective_client_id() = client_id)
  WITH CHECK (public.get_user_role() = 'client' AND public.effective_client_id() = client_id);

DROP POLICY IF EXISTS "Superadmin full vault_files" ON public.vault_files;
DROP POLICY IF EXISTS "CM manage assigned vault_files" ON public.vault_files;
DROP POLICY IF EXISTS "Clients read own vault_files" ON public.vault_files;

CREATE POLICY "Superadmin full vault_files"
  ON public.vault_files FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned vault_files"
  ON public.vault_files FOR ALL
  USING (public.is_client_manager() AND public.can_access_client(client_id))
  WITH CHECK (public.is_client_manager() AND public.can_access_client(client_id));

CREATE POLICY "Clients read own vault_files"
  ON public.vault_files FOR SELECT
  USING (public.effective_client_id() = client_id);

ALTER TABLE public.web_style_guide_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Web style guide items" ON public.web_style_guide_items;
CREATE POLICY "Web style guide items" ON public.web_style_guide_items
  FOR ALL USING (public.is_superadmin() OR public.can_access_client(client_id))
  WITH CHECK (public.is_superadmin() OR public.can_access_client(client_id));

DROP POLICY IF EXISTS "Superadmin full portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "CM manage assigned portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "Clients read own portal_activity" ON public.portal_activity;
DROP POLICY IF EXISTS "Clients insert own portal_activity" ON public.portal_activity;

CREATE POLICY "Superadmin full portal_activity"
  ON public.portal_activity FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "CM manage assigned portal_activity"
  ON public.portal_activity FOR ALL
  USING (public.is_client_manager() AND client_id IS NOT NULL AND public.can_access_client(client_id))
  WITH CHECK (public.is_client_manager() AND client_id IS NOT NULL AND public.can_access_client(client_id));

CREATE POLICY "Clients read own portal_activity"
  ON public.portal_activity FOR SELECT
  USING (public.effective_client_id() = client_id);

CREATE POLICY "Clients insert own portal_activity"
  ON public.portal_activity FOR INSERT
  WITH CHECK (public.effective_client_id() = client_id);

DROP POLICY IF EXISTS "Superadmin manage announcements" ON public.global_announcements;
DROP POLICY IF EXISTS "Authenticated read active announcements" ON public.global_announcements;

CREATE POLICY "Superadmin manage announcements"
  ON public.global_announcements FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

CREATE POLICY "Authenticated read active announcements"
  ON public.global_announcements FOR SELECT
  USING (is_active AND (ends_at IS NULL OR ends_at > now()));

DROP POLICY IF EXISTS "Users manage own preferences" ON public.user_preferences;
CREATE POLICY "Users manage own preferences"
  ON public.user_preferences FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "BD staff partnerships" ON public.bd_partnerships;
CREATE POLICY "BD staff partnerships"
  ON public.bd_partnerships FOR ALL
  USING (public.is_superadmin() OR public.is_bd_staff())
  WITH CHECK (public.is_superadmin() OR public.is_bd_staff());

DROP POLICY IF EXISTS "BD staff marketing tasks" ON public.bd_marketing_tasks;
CREATE POLICY "BD staff marketing tasks"
  ON public.bd_marketing_tasks FOR ALL
  USING (public.is_superadmin() OR public.is_bd_staff())
  WITH CHECK (public.is_superadmin() OR public.is_bd_staff());

GRANT ALL ON TABLE public.client_manager_assignments TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.client_manager_profiles TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
