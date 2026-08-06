-- =============================================================================
-- WIDE Portal — Drop unused schema + harden RLS on live tables
-- Migration: 20260805140256_drop_unused_schema_and_enable_rls.sql
--
-- Removes tables/buckets the Next.js app never queries, detaches the orphaned
-- process-graph FK from workspace_assignments, and enables RLS on lookup tables
-- that were previously exposed without policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Detach kept tables from process graph before drops
-- ---------------------------------------------------------------------------
ALTER TABLE public.workspace_assignments
  DROP CONSTRAINT IF EXISTS workspace_assignments_process_step_id_fkey;

ALTER TABLE public.workspace_assignments
  DROP COLUMN IF EXISTS process_step_id;

-- ---------------------------------------------------------------------------
-- 2. Drop unused tables (children first)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.step_system_automations CASCADE;
DROP TABLE IF EXISTS public.process_edges CASCADE;
DROP TABLE IF EXISTS public.process_steps CASCADE;
DROP TABLE IF EXISTS public.process_templates CASCADE;
DROP TABLE IF EXISTS public.process_services CASCADE;
DROP TABLE IF EXISTS public.expertise_tracks CASCADE;

DROP TABLE IF EXISTS public.bd_marketing_tasks CASCADE;
DROP TABLE IF EXISTS public.bd_partnerships CASCADE;

DROP TABLE IF EXISTS public.ci_imports CASCADE;

DROP TABLE IF EXISTS public.client_delivery_gates CASCADE;
DROP TABLE IF EXISTS public.client_manager_assignments CASCADE;
DROP TABLE IF EXISTS public.client_manager_profiles CASCADE;
DROP TABLE IF EXISTS public.client_proposals CASCADE;

DROP TABLE IF EXISTS public.erp_invoice_line_items CASCADE;
DROP TABLE IF EXISTS public.erp_leave_requests CASCADE;
DROP TABLE IF EXISTS public.erp_payments CASCADE;

DROP TABLE IF EXISTS public.finance_identified_revenues CASCADE;
DROP TABLE IF EXISTS public.finance_identified_costs CASCADE;
DROP TABLE IF EXISTS public.finance_actual_revenues CASCADE;
DROP TABLE IF EXISTS public.finance_actual_costs CASCADE;
DROP TABLE IF EXISTS public.finance_unidentified_revenues CASCADE;
DROP TABLE IF EXISTS public.finance_unidentified_costs CASCADE;

DROP TABLE IF EXISTS public.prospect_budget_costs CASCADE;
DROP TABLE IF EXISTS public.report_configurations CASCADE;
DROP TABLE IF EXISTS public.workspace_assets CASCADE;

-- Unused storage buckets (ci-assets, brand-assets, people-legal) are empty and
-- must be removed via Storage API / Dashboard — direct DELETE on storage.* is blocked.

-- ---------------------------------------------------------------------------
-- 3. Enable RLS on staff lookup / assignment tables that were open
-- ---------------------------------------------------------------------------

-- activity_types: staff CRUD (timesheets, activity costs)
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff manage activity_types" ON public.activity_types;
CREATE POLICY "Agency staff manage activity_types"
  ON public.activity_types
  FOR ALL
  TO authenticated
  USING (public.is_agency_staff())
  WITH CHECK (public.is_agency_staff());

-- project_types: staff CRUD
ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff manage project_types" ON public.project_types;
CREATE POLICY "Agency staff manage project_types"
  ON public.project_types
  FOR ALL
  TO authenticated
  USING (public.is_agency_staff())
  WITH CHECK (public.is_agency_staff());

-- workspace_assignments: staff manage; clients can read managers on their workspace
ALTER TABLE public.workspace_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff manage workspace_assignments" ON public.workspace_assignments;
CREATE POLICY "Agency staff manage workspace_assignments"
  ON public.workspace_assignments
  FOR ALL
  TO authenticated
  USING (public.is_agency_staff())
  WITH CHECK (public.is_agency_staff());

DROP POLICY IF EXISTS "Clients can view own workspace_assignments" ON public.workspace_assignments;
CREATE POLICY "Clients can view own workspace_assignments"
  ON public.workspace_assignments
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id
      FROM public.workspaces w
      WHERE w.client_profile_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
