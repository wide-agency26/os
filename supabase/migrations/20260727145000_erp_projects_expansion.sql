-- =====================================================================
-- ERPNext Projects Module Expansion
-- Links tasks, timesheets, expenses, and invoices to Projects.
-- Adds Project Types, Project Templates, and Activity Types.
-- =====================================================================

-- 1. Support Tables for Projects
CREATE TABLE IF NOT EXISTS public.project_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_type_id UUID REFERENCES public.project_types(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.activity_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_costing_rate NUMERIC(10, 2) DEFAULT 0.00,
    default_billing_rate NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Seed basic Activity Types
INSERT INTO public.activity_types (name) VALUES 
('Planning'), ('Research'), ('Proposal Writing'), ('Execution'), ('Communication')
ON CONFLICT DO NOTHING;

-- 2. Modify existing Projects table (if not exists, wait, it exists in initial_schema)
-- We will just make sure it has the fields we need. It already has:
-- id, client_id, title, scope, status, start_date, end_date, etc.
-- Let's add estimated_cost, expected_start_date, expected_end_date if they don't exist.
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS expected_start_date DATE,
ADD COLUMN IF NOT EXISTS expected_end_date DATE,
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS project_type_id UUID REFERENCES public.project_types(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_template_id UUID REFERENCES public.project_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')) DEFAULT 'Medium',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS completion_method TEXT CHECK (completion_method IN ('Manual', 'Task Completion', 'Task Progress', 'Task Weight')) DEFAULT 'Task Completion';

-- 3. Link ERP Tables to Projects
ALTER TABLE public.erp_tasks
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')) DEFAULT 'Medium',
ADD COLUMN IF NOT EXISTS weight NUMERIC(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS expected_start_date DATE,
ADD COLUMN IF NOT EXISTS expected_end_date DATE,
ADD COLUMN IF NOT EXISTS expected_time NUMERIC(6, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS progress NUMERIC(5, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.erp_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.erp_timesheets
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS activity_type_id UUID REFERENCES public.activity_types(id) ON DELETE SET NULL;

ALTER TABLE public.erp_expenses
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.erp_invoices
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
