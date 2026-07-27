-- Polymorphic Workspace model (ADDITIVE — does not drop or modify legacy tables).
-- Introduces the unified workspace ledger alongside the existing schema so the
-- new /admin/work surface and future portals can adopt it incrementally.

-- =====================================================================
-- Core polymorphic workspace ledger
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    current_tier TEXT CHECK (current_tier IN ('Launch Kit', 'Startup Launch', 'Growth Program', 'Full Partnership', 'Lead')),
    lifecycle_status TEXT NOT NULL DEFAULT 'Lead' CHECK (lifecycle_status IN ('Lead', 'Prospect', 'Active', 'Partner', 'Closed')),
    estimated_value NUMERIC(12, 2) DEFAULT 0.00,
    actual_revenue NUMERIC(12, 2) DEFAULT 0.00,
    burn_rate_override NUMERIC(12, 2) DEFAULT 0.00,
    current_phase INT DEFAULT 1 CHECK (current_phase BETWEEN 1 AND 5),
    -- Optional bridge to the existing profiles model during incremental adoption.
    client_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- Internal people & capacity allocation
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    person_type TEXT CHECK (person_type IN ('Founder', 'Employee', 'Intern', 'Freelancer', 'Partner_Contact')),
    expertise_tags TEXT[] DEFAULT '{}',
    capacity_score INT CHECK (capacity_score BETWEEN 0 AND 100) DEFAULT 100,
    hourly_rate_cost NUMERIC(10, 2) DEFAULT 0.00,
    availability_status TEXT CHECK (availability_status IN ('Available', 'Busy')) DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- Shared workspace allocations matrix
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.workspace_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (workspace_id, person_id)
);

-- =====================================================================
-- Unit assets & deliverables hub
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.workspace_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category TEXT CHECK (category IN ('Brand Guidelines', 'Web Styleguide', 'Shared Files', 'Contract', 'Invoice')),
    structured_json_payload JSONB DEFAULT '{}'::jsonb,
    file_path_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- Indexes
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_lifecycle ON public.workspaces(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_workspace_assignments_workspace ON public.workspace_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_assignments_person ON public.workspace_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_workspace_assets_workspace ON public.workspace_assets(workspace_id);

-- =====================================================================
-- updated_at trigger for workspaces
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_workspaces_updated_at();

-- =====================================================================
-- Row Level Security — founders (superadmin) get full read/write.
-- Reuses existing helper functions from migration 0007.
-- =====================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspaces_founder_all ON public.workspaces;
CREATE POLICY workspaces_founder_all ON public.workspaces
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS people_founder_all ON public.people;
CREATE POLICY people_founder_all ON public.people
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS workspace_assignments_founder_all ON public.workspace_assignments;
CREATE POLICY workspace_assignments_founder_all ON public.workspace_assignments
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS workspace_assets_founder_all ON public.workspace_assets;
CREATE POLICY workspace_assets_founder_all ON public.workspace_assets
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
