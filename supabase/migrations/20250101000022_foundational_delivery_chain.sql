-- =============================================================================
-- WIDE OS — Bottoms-up chain: Resources → Tasks → Phases → Workspaces
-- Migration: 20250101000022_foundational_delivery_chain.sql
-- =============================================================================

-- Sync display name on existing people ledger
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE public.people SET name = full_name WHERE name IS NULL;

-- LEVEL 1: Tools & pass-through resources (separate from human people ledger)
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_name TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('Tool', 'Other_Resource')),
  billing_type TEXT NOT NULL DEFAULT 'Fixed_Monthly'
    CHECK (billing_type IN ('Fixed_Monthly', 'Annual', 'Per_Project_Pass_Through')),
  cost_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  access_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_name ON public.resources(resource_name);
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(resource_type);

-- LEVEL 2: Project phases (workspace = project)
CREATE TABLE IF NOT EXISTS public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phase_order INT NOT NULL,
  phase_title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (workspace_id, phase_order)
);

CREATE INDEX IF NOT EXISTS idx_project_phases_workspace ON public.project_phases(workspace_id, phase_order);

-- LEVEL 3: Atomic tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.project_phases(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  assigned_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  assigned_resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  duration_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  task_type TEXT NOT NULL DEFAULT 'Deliverable'
    CHECK (task_type IN ('Deliverable', 'Internal File', 'Link', 'Milestone')),
  needs_client_confirmation BOOLEAN NOT NULL DEFAULT false,
  confirmation_deadline TIMESTAMPTZ,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_tasks_phase ON public.tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_tasks_person ON public.tasks(assigned_person_id);

-- Default phase ladder for every workspace
CREATE OR REPLACE FUNCTION public.ensure_workspace_phases(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.project_phases WHERE workspace_id = p_workspace_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.project_phases (workspace_id, phase_order, phase_title) VALUES
    (p_workspace_id, 1, 'Contracts & Paperwork'),
    (p_workspace_id, 2, 'Kickoff Workshop'),
    (p_workspace_id, 3, 'Creative Production Sprint 1'),
    (p_workspace_id, 4, 'Creative Production Sprint 2'),
    (p_workspace_id, 5, 'Launch & Handoff');
END;
$$;

-- Seed starter tools & pass-through resources (idempotent by name)
INSERT INTO public.resources (resource_name, resource_type, billing_type, cost_amount, access_link)
VALUES
  ('Figma Professional', 'Tool', 'Fixed_Monthly', 15.00, 'https://figma.com'),
  ('Webflow Workspace', 'Tool', 'Fixed_Monthly', 49.00, 'https://webflow.com'),
  ('Framer Enterprise', 'Tool', 'Fixed_Monthly', 30.00, 'https://framer.com'),
  ('Webflow CMS Site Plan', 'Other_Resource', 'Per_Project_Pass_Through', 49.00, NULL),
  ('High-Intent Keyword API', 'Other_Resource', 'Per_Project_Pass_Through', 120.00, NULL),
  ('Analytics Platform Seat', 'Other_Resource', 'Fixed_Monthly', 120.00, NULL)
ON CONFLICT (resource_name) DO NOTHING;

-- RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin resources" ON public.resources;
CREATE POLICY "Superadmin resources" ON public.resources
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read resources" ON public.resources;
CREATE POLICY "Authenticated read resources" ON public.resources
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin project_phases" ON public.project_phases;
CREATE POLICY "Superadmin project_phases" ON public.project_phases
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read project_phases" ON public.project_phases;
CREATE POLICY "Authenticated read project_phases" ON public.project_phases
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Superadmin tasks" ON public.tasks;
CREATE POLICY "Superadmin tasks" ON public.tasks
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read tasks" ON public.tasks;
CREATE POLICY "Authenticated read tasks" ON public.tasks
  FOR SELECT USING (auth.role() = 'authenticated');

GRANT EXECUTE ON FUNCTION public.ensure_workspace_phases(UUID) TO authenticated, service_role;

DROP TRIGGER IF EXISTS set_resources_updated_at ON public.resources;
CREATE TRIGGER set_resources_updated_at
  BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
