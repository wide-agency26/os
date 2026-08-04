-- =============================================================================
-- WIDE Portal — Migration: Fix Projects Infinite Recursion RLS Policy
-- Migration: 20260804200000_fix_projects_infinite_recursion_rls.sql
-- =============================================================================

-- 1. Drop all potentially conflicting or recursive policies on public.projects
DROP POLICY IF EXISTS "Public can view projects with published guidelines" ON public.projects;
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins have full access to projects" ON public.projects;
DROP POLICY IF EXISTS "Superadmin projects" ON public.projects;
DROP POLICY IF EXISTS "Enable all access for authenticated users on projects" ON public.projects;

-- 2. Re-establish clean, non-recursive policy for authenticated users on projects
CREATE POLICY "Enable all access for authenticated users on projects" 
  ON public.projects 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

-- 3. Clean up any leftover public policies on CI tables
DROP POLICY IF EXISTS "Public can view published guidelines" ON public.ci_guidelines;
DROP POLICY IF EXISTS "Public can view published versions" ON public.ci_guideline_versions;
DROP POLICY IF EXISTS "Public can view assets of published guidelines" ON public.ci_assets;
