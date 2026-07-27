-- Fix RLS for projects, tasks, and timesheets to allow authenticated users to perform CRUD operations
-- Since this is an internal ERP, we want to allow admins/founders to insert without strict role blocking if roles are misconfigured.

-- 1. Projects
DROP POLICY IF EXISTS "Superadmin projects" ON public.projects;
DROP POLICY IF EXISTS "Client read own projects" ON public.projects;
DROP POLICY IF EXISTS "Enable all access for authenticated users on projects" ON public.projects;

CREATE POLICY "Enable all access for authenticated users on projects" 
ON public.projects FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. ERP Tasks
DROP POLICY IF EXISTS erp_tasks_founder_all ON public.erp_tasks;
DROP POLICY IF EXISTS "Enable all access for authenticated users on erp_tasks" ON public.erp_tasks;

CREATE POLICY "Enable all access for authenticated users on erp_tasks" 
ON public.erp_tasks FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. ERP Timesheets
DROP POLICY IF EXISTS erp_timesheets_founder_all ON public.erp_timesheets;
DROP POLICY IF EXISTS "Enable all access for authenticated users on erp_timesheets" ON public.erp_timesheets;

CREATE POLICY "Enable all access for authenticated users on erp_timesheets" 
ON public.erp_timesheets FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Activity Types and Project Types (Dictionaries)
DROP POLICY IF EXISTS "Enable all access for authenticated users on activity_types" ON public.activity_types;
CREATE POLICY "Enable all access for authenticated users on activity_types" 
ON public.activity_types FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated users on project_types" ON public.project_types;
CREATE POLICY "Enable all access for authenticated users on project_types" 
ON public.project_types FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
