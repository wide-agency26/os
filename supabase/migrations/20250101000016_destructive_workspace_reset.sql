-- =============================================================================
-- WIDE OS — Destructive workspace reset (IRREVERSIBLE DATA LOSS)
-- Migration: 20250101000016_destructive_workspace_reset.sql
--
-- Drops legacy multi-table business data. Keeps auth.users + profiles (auth bridge).
-- Rebuilds around the polymorphic workspaces ledger + RLS member slices.
-- =============================================================================

-- ---- Drop legacy business tables (dependency-safe order) --------------------
DROP TABLE IF EXISTS public.client_requests CASCADE;
DROP TABLE IF EXISTS public.client_proposals CASCADE;
DROP TABLE IF EXISTS public.prospect_proposals CASCADE;
DROP TABLE IF EXISTS public.prospect_budget_costs CASCADE;
DROP TABLE IF EXISTS public.client_delivery_gates CASCADE;
DROP TABLE IF EXISTS public.prospects CASCADE;
DROP TABLE IF EXISTS public.bd_marketing_tasks CASCADE;
DROP TABLE IF EXISTS public.bd_partnerships CASCADE;
DROP TABLE IF EXISTS public.finance_unidentified_costs CASCADE;
DROP TABLE IF EXISTS public.finance_unidentified_revenues CASCADE;
DROP TABLE IF EXISTS public.finance_identified_costs CASCADE;
DROP TABLE IF EXISTS public.finance_identified_revenues CASCADE;
DROP TABLE IF EXISTS public.finance_actual_costs CASCADE;
DROP TABLE IF EXISTS public.finance_actual_revenues CASCADE;
DROP TABLE IF EXISTS public.web_style_guide_items CASCADE;
DROP TABLE IF EXISTS public.web_style_guide_snapshots CASCADE;
DROP TABLE IF EXISTS public.vault_downloads CASCADE;
DROP TABLE IF EXISTS public.vault_files CASCADE;
DROP TABLE IF EXISTS public.portal_activity CASCADE;
DROP TABLE IF EXISTS public.brand_hubs CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.client_manager_assignments CASCADE;
DROP TABLE IF EXISTS public.client_manager_profiles CASCADE;

-- Recreate workspace satellite tables (clean slate)
DROP TABLE IF EXISTS public.workspace_assets CASCADE;
DROP TABLE IF EXISTS public.workspace_assignments CASCADE;
DROP TABLE IF EXISTS public.ai_hq_jobs CASCADE;
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.finance_identified_opportunities CASCADE;

-- ---- Enhance workspaces -----------------------------------------------------
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS phase_3_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phase_3_signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creative_routes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS owner_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prospect_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---- Auth bridge on profiles -----------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_workspace ON public.profiles(workspace_id);

-- ---- Workspace member slices (RLS) ------------------------------------------
CREATE TABLE public.workspace_members (
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_role TEXT NOT NULL CHECK (member_role IN ('founder', 'client', 'prospect', 'partner')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);

-- ---- Recreate assets & assignments ------------------------------------------
CREATE TABLE public.workspace_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (workspace_id, person_id)
);

CREATE TABLE public.workspace_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category TEXT CHECK (category IN ('Brand Guidelines', 'Web Styleguide', 'Shared Files', 'Contract', 'Invoice')),
    structured_json_payload JSONB DEFAULT '{}'::jsonb,
    file_path_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_workspace_assets_workspace ON public.workspace_assets(workspace_id);

-- ---- Identified ledger (synced from workspace expansions) -------------------
CREATE TABLE public.finance_identified_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    company_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    lifecycle_status TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---- AI HQ draft queue ------------------------------------------------------
CREATE TABLE public.ai_hq_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    result_json JSONB DEFAULT '{}'::jsonb,
    is_draft BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'approved', 'rejected', 'executed')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---- Sync trigger: expansion → identified ledger ----------------------------
CREATE OR REPLACE FUNCTION public.sync_workspace_identified_ledger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lifecycle_status IN ('Lead', 'Prospect') AND COALESCE(NEW.estimated_value, 0) > 0 THEN
    INSERT INTO public.finance_identified_opportunities (workspace_id, company_name, amount, lifecycle_status, synced_at)
    VALUES (NEW.id, NEW.company_name, NEW.estimated_value, NEW.lifecycle_status, NOW())
    ON CONFLICT (workspace_id) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      amount = EXCLUDED.amount,
      lifecycle_status = EXCLUDED.lifecycle_status,
      synced_at = NOW();
  ELSIF NEW.lifecycle_status NOT IN ('Lead', 'Prospect') THEN
    DELETE FROM public.finance_identified_opportunities WHERE workspace_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_identified_sync ON public.workspaces;
CREATE TRIGGER trg_workspace_identified_sync
  AFTER INSERT OR UPDATE OF lifecycle_status, estimated_value, company_name ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_identified_ledger();

-- ---- Prospect /prospect/[id]/agreement signature → Active client ------------
CREATE OR REPLACE FUNCTION public.convert_workspace_on_agreement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agreement_signed_at IS NOT NULL
     AND OLD.agreement_signed_at IS NULL
     AND OLD.lifecycle_status IN ('Lead', 'Prospect') THEN
    NEW.lifecycle_status := 'Active';
    NEW.current_phase := 1;
    NEW.updated_at := TIMEZONE('utc'::text, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_agreement_conversion ON public.workspaces;
CREATE TRIGGER trg_workspace_agreement_conversion
  BEFORE UPDATE OF agreement_signed_at ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.convert_workspace_on_agreement();

-- ---- RLS helpers ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.workspace_member_role(ws_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_role FROM public.workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid()
  LIMIT 1;
$$;

-- ---- RLS policies -----------------------------------------------------------
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hq_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_identified_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_members_founder ON public.workspace_members;
CREATE POLICY workspace_members_founder ON public.workspace_members
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS workspace_members_self_read ON public.workspace_members;
CREATE POLICY workspace_members_self_read ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS workspaces_founder_all ON public.workspaces;
DROP POLICY IF EXISTS workspaces_member_read ON public.workspaces;
CREATE POLICY workspaces_member_read ON public.workspaces
  FOR SELECT USING (
    public.is_superadmin()
    OR public.workspace_member_role(id) IS NOT NULL
    OR client_profile_id = auth.uid()
    OR owner_auth_user_id = auth.uid()
    OR prospect_auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS workspaces_founder_write ON public.workspaces;
CREATE POLICY workspaces_founder_write ON public.workspaces
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS workspace_assets_member_read ON public.workspace_assets;
CREATE POLICY workspace_assets_member_read ON public.workspace_assets
  FOR SELECT USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id
        AND (
          public.workspace_member_role(w.id) IS NOT NULL
          OR w.client_profile_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS workspace_assets_founder_write ON public.workspace_assets;
CREATE POLICY workspace_assets_founder_write ON public.workspace_assets
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS ai_hq_founder ON public.ai_hq_jobs;
CREATE POLICY ai_hq_founder ON public.ai_hq_jobs
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS finance_identified_founder ON public.finance_identified_opportunities;
CREATE POLICY finance_identified_founder ON public.finance_identified_opportunities
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
