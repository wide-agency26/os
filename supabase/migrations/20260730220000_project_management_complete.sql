-- =====================================================================
-- WIDE OS — Full Project Management System
-- Adds all missing ERPNext-inspired tables & columns for a complete
-- project management module: task types, dependencies, project users,
-- project updates, activity costs, timesheet details, project settings.
-- =====================================================================

-- =====================================================================
-- 1. NEW TABLES
-- =====================================================================

-- Task Types (categorise tasks: Bug, Feature, Research, etc.)
CREATE TABLE IF NOT EXISTS public.erp_task_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed basic task types
INSERT INTO public.erp_task_types (name) VALUES
('Bug'), ('Feature'), ('Research'), ('Design'), ('Review'), ('Deployment'), ('Support')
ON CONFLICT DO NOTHING;

-- Task Dependencies (task A depends on task B)
CREATE TABLE IF NOT EXISTS public.erp_task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.erp_tasks(id) ON DELETE CASCADE,
    depends_on_task_id UUID NOT NULL REFERENCES public.erp_tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(task_id, depends_on_task_id),
    CHECK (task_id <> depends_on_task_id)
);
CREATE INDEX IF NOT EXISTS idx_task_deps_task ON public.erp_task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends ON public.erp_task_dependencies(depends_on_task_id);

-- Project Users (team members assigned to a project)
CREATE TABLE IF NOT EXISTS public.erp_project_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_role TEXT DEFAULT 'Member',
    welcome_email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_users_project ON public.erp_project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_project_users_user ON public.erp_project_users(user_id);

-- Project Updates (weekly/periodic status updates per project)
CREATE TABLE IF NOT EXISTS public.erp_project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    update_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('On Track', 'At Risk', 'Behind Schedule', 'Completed')) DEFAULT 'On Track',
    progress_snapshot NUMERIC(5, 2) DEFAULT 0,
    summary TEXT,
    challenges TEXT,
    next_steps TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_updates_project ON public.erp_project_updates(project_id, update_date DESC);

-- Activity Costs (per-employee cost/billing rate overrides for activity types)
CREATE TABLE IF NOT EXISTS public.erp_activity_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    activity_type_id UUID NOT NULL REFERENCES public.activity_types(id) ON DELETE CASCADE,
    costing_rate NUMERIC(10, 2) DEFAULT 0.00,
    billing_rate NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(person_id, activity_type_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_costs_person ON public.erp_activity_costs(person_id);

-- Timesheet Details (multi-row entries per timesheet — ERPNext pattern)
CREATE TABLE IF NOT EXISTS public.erp_timesheet_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id UUID NOT NULL REFERENCES public.erp_timesheets(id) ON DELETE CASCADE,
    activity_type_id UUID REFERENCES public.activity_types(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.erp_tasks(id) ON DELETE SET NULL,
    from_time TIMESTAMPTZ,
    to_time TIMESTAMPTZ,
    hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
    is_billable BOOLEAN DEFAULT true,
    billing_rate NUMERIC(10, 2) DEFAULT 0,
    costing_rate NUMERIC(10, 2) DEFAULT 0,
    billing_amount NUMERIC(12, 2) DEFAULT 0,
    costing_amount NUMERIC(12, 2) DEFAULT 0,
    description TEXT,
    sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_timesheet_details_ts ON public.erp_timesheet_details(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_details_project ON public.erp_timesheet_details(project_id);

-- Project Settings (singleton configuration)
CREATE TABLE IF NOT EXISTS public.erp_project_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_completion_method TEXT CHECK (default_completion_method IN ('Manual', 'Task Completion', 'Task Progress', 'Task Weight')) DEFAULT 'Task Completion',
    default_project_type_id UUID REFERENCES public.project_types(id) ON DELETE SET NULL,
    ignore_weekends BOOLEAN DEFAULT true,
    ignore_employee_time_overlap BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed one settings row
INSERT INTO public.erp_project_settings (default_completion_method)
SELECT 'Task Completion'
WHERE NOT EXISTS (SELECT 1 FROM public.erp_project_settings);

-- =====================================================================
-- 2. ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================================

-- Projects: add computed/aggregate fields
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS percent_complete NUMERIC(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_start_date DATE,
    ADD COLUMN IF NOT EXISTS actual_end_date DATE,
    ADD COLUMN IF NOT EXISTS actual_time NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_costing_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_billable_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_billed_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gross_margin NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS copied_from UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS company TEXT,
    ADD COLUMN IF NOT EXISTS sales_order TEXT,
    ADD COLUMN IF NOT EXISTS cost_center TEXT;

-- Tasks: add missing fields
ALTER TABLE public.erp_tasks
    ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES public.erp_task_types(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS completed_on TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_start_date DATE,
    ADD COLUMN IF NOT EXISTS actual_end_date DATE,
    ADD COLUMN IF NOT EXISTS actual_time NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS review_date DATE,
    ADD COLUMN IF NOT EXISTS closing_date DATE;

-- Timesheets: add aggregate fields for multi-detail model
ALTER TABLE public.erp_timesheets
    ADD COLUMN IF NOT EXISTS total_hours NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_billable_hours NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_billable_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_costing_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS note TEXT;

-- Project Template Tasks: add start/duration for date calculation
ALTER TABLE public.project_template_tasks
    ADD COLUMN IF NOT EXISTS start_offset_days INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS duration_days INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS depends_on_task_idx INT,
    ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- =====================================================================
-- 3. TRIGGERS
-- =====================================================================

-- Updated_at triggers for new tables
CREATE TRIGGER trg_erp_project_settings_updated_at
    BEFORE UPDATE ON public.erp_project_settings
    FOR EACH ROW EXECUTE FUNCTION public.touch_erp_updated_at();

-- =====================================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.erp_task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_project_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_activity_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_timesheet_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_project_settings ENABLE ROW LEVEL SECURITY;

-- Superadmin full access on all new tables
CREATE POLICY erp_task_types_founder_all ON public.erp_task_types FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_task_deps_founder_all ON public.erp_task_dependencies FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_project_users_founder_all ON public.erp_project_users FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_project_updates_founder_all ON public.erp_project_updates FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_activity_costs_founder_all ON public.erp_activity_costs FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_timesheet_details_founder_all ON public.erp_timesheet_details FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_project_settings_founder_all ON public.erp_project_settings FOR ALL
    USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- Authenticated read access for team visibility
CREATE POLICY erp_task_types_auth_read ON public.erp_task_types FOR SELECT
    TO authenticated USING (true);
CREATE POLICY erp_task_deps_auth_read ON public.erp_task_dependencies FOR SELECT
    TO authenticated USING (true);
CREATE POLICY erp_project_users_auth_read ON public.erp_project_users FOR SELECT
    TO authenticated USING (true);
CREATE POLICY erp_project_updates_auth_read ON public.erp_project_updates FOR SELECT
    TO authenticated USING (true);
CREATE POLICY erp_activity_costs_auth_read ON public.erp_activity_costs FOR SELECT
    TO authenticated USING (true);
CREATE POLICY erp_timesheet_details_auth_read ON public.erp_timesheet_details FOR SELECT
    TO authenticated USING (true);
CREATE POLICY erp_project_settings_auth_read ON public.erp_project_settings FOR SELECT
    TO authenticated USING (true);

-- Agency staff write access (they manage projects)
CREATE POLICY erp_task_types_staff_write ON public.erp_task_types FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());
CREATE POLICY erp_task_deps_staff_write ON public.erp_task_dependencies FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());
CREATE POLICY erp_project_users_staff_write ON public.erp_project_users FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());
CREATE POLICY erp_project_updates_staff_write ON public.erp_project_updates FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());
CREATE POLICY erp_activity_costs_staff_write ON public.erp_activity_costs FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());
CREATE POLICY erp_timesheet_details_staff_write ON public.erp_timesheet_details FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());
CREATE POLICY erp_project_settings_staff_write ON public.erp_project_settings FOR ALL
    TO authenticated USING (public.is_agency_staff()) WITH CHECK (public.is_agency_staff());

-- =====================================================================
-- 5. GRANTS
-- =====================================================================
GRANT ALL ON TABLE public.erp_task_types TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.erp_task_dependencies TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.erp_project_users TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.erp_project_updates TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.erp_activity_costs TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.erp_timesheet_details TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.erp_project_settings TO postgres, anon, authenticated, service_role;

SELECT 'Project Management Complete migration applied.' AS note;
