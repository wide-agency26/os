-- =============================================================================
-- PM Module: Playbooks, live tasks, cost stubs
-- ADDITIVE ONLY — does not alter CI Builder / Reports tables or projects.client_id
-- =============================================================================

-- 1. Catalog (replaces dropped Services/Packages CMS for playbook FKs)
CREATE TABLE IF NOT EXISTS public.pm_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('strategy', 'brand', 'growth', 'content', 'website')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pm_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  cadence_type TEXT NOT NULL CHECK (cadence_type IN ('one_off', 'recurring')),
  recurrence_unit TEXT, -- e.g. monthly
  high_level_process TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pm_package_services (
  package_id UUID NOT NULL REFERENCES public.pm_packages(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.pm_services(id) ON DELETE CASCADE,
  PRIMARY KEY (package_id, service_id)
);

-- 2. Playbook layer
CREATE TABLE IF NOT EXISTS public.service_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL UNIQUE REFERENCES public.pm_services(id) ON DELETE CASCADE,
  cadence_type TEXT NOT NULL CHECK (cadence_type IN ('one_off', 'recurring')),
  recurrence_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_playbook_id UUID NOT NULL REFERENCES public.service_playbooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  deliverable TEXT,
  default_role TEXT NOT NULL DEFAULT 'Specialist',
  estimated_duration_hours NUMERIC(8,2) DEFAULT 0,
  is_gate BOOLEAN NOT NULL DEFAULT false,
  depends_on UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  phase_label TEXT,
  recurs BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.package_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL UNIQUE REFERENCES public.pm_packages(id) ON DELETE CASCADE,
  cadence_type TEXT NOT NULL CHECK (cadence_type IN ('one_off', 'recurring')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.package_playbook_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_playbook_id UUID NOT NULL REFERENCES public.package_playbooks(id) ON DELETE CASCADE,
  service_playbook_id UUID NOT NULL REFERENCES public.service_playbooks(id) ON DELETE CASCADE,
  sequence_group INT NOT NULL DEFAULT 0,
  parallel BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (package_playbook_id, service_playbook_id)
);

CREATE TABLE IF NOT EXISTS public.package_playbook_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_playbook_id UUID NOT NULL REFERENCES public.package_playbooks(id) ON DELETE CASCADE,
  after_task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  blocks_service_playbook_id UUID NOT NULL REFERENCES public.service_playbooks(id) ON DELETE CASCADE
);

-- 3. Live project instance layer (pm_tasks — avoids collision with legacy `tasks` / erp_tasks)
CREATE TABLE IF NOT EXISTS public.pm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  default_role TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),
  is_gate BOOLEAN NOT NULL DEFAULT false,
  depends_on UUID REFERENCES public.pm_tasks(id) ON DELETE SET NULL,
  phase_label TEXT,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'template', 'email')),
  source_ref TEXT,
  cycle_key TEXT, -- e.g. 2026-08 for recurring cycles; null for one-off
  estimated_duration_hours NUMERIC(8,2),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pm_tasks_project_id_idx ON public.pm_tasks (project_id);
CREATE INDEX IF NOT EXISTS pm_tasks_assignee_id_idx ON public.pm_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS pm_tasks_status_idx ON public.pm_tasks (status);
CREATE INDEX IF NOT EXISTS pm_tasks_last_activity_idx ON public.pm_tasks (last_activity_at);

CREATE TABLE IF NOT EXISTS public.task_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposed_title TEXT NOT NULL,
  proposed_description TEXT,
  source_ref TEXT,
  suggested_match_task_id UUID REFERENCES public.pm_tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'edited', 'discarded', 'merged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS task_review_queue_project_pending_idx
  ON public.task_review_queue (project_id) WHERE status = 'pending';

-- 4. Resource / cost layer
CREATE TABLE IF NOT EXISTS public.resource_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- YYYY-MM
  allocation_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'derived'
    CHECK (source IN ('derived', 'manual_override')),
  UNIQUE (person_id, project_id, period)
);

CREATE TABLE IF NOT EXISTS public.cost_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  planned_hours NUMERIC(10,2) DEFAULT 0,
  planned_cost NUMERIC(12,2) DEFAULT 0,
  fragmentation_multiplier NUMERIC(6,3) DEFAULT 1,
  projected_cost NUMERIC(12,2) DEFAULT 0,
  projected_completion_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, period)
);

CREATE TABLE IF NOT EXISTS public.pm_role_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_label TEXT NOT NULL UNIQUE,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pm_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fragmentation_base_projects INT NOT NULL DEFAULT 2,
  fragmentation_penalty_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  stale_after_days INT NOT NULL DEFAULT 7,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.pm_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Additive project columns (nullable — existing projects unchanged)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS package_playbook_id UUID REFERENCES public.package_playbooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_cycle_key TEXT,
  ADD COLUMN IF NOT EXISTS pm_inbound_email TEXT;

CREATE INDEX IF NOT EXISTS projects_package_playbook_id_idx
  ON public.projects (package_playbook_id)
  WHERE package_playbook_id IS NOT NULL;

-- 6. RLS — founders/admins full access (match existing get_user_role patterns)
ALTER TABLE public.pm_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_package_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_playbook_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_playbook_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_role_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pm_services','pm_packages','pm_package_services','service_playbooks','task_templates',
    'package_playbooks','package_playbook_members','package_playbook_gates',
    'pm_tasks','task_review_queue','resource_allocations','cost_estimates',
    'pm_role_rates','pm_settings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Admins full access %s" ON public.%I FOR ALL USING (public.get_user_role() IN (''admin'', ''superadmin'')) WITH CHECK (public.get_user_role() IN (''admin'', ''superadmin''))',
      t, t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Assignees can read their own tasks
DROP POLICY IF EXISTS "Users read assigned pm_tasks" ON public.pm_tasks;
CREATE POLICY "Users read assigned pm_tasks"
  ON public.pm_tasks FOR SELECT
  USING (assignee_id = auth.uid() OR public.get_user_role() IN ('admin', 'superadmin'));
