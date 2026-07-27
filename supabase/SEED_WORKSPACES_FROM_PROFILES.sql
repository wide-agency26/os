-- Backfill workspaces from existing client profiles (run once after 015 + 017).
-- Safe to re-run: skips clients that already have a workspace.

INSERT INTO public.workspaces (
  company_name,
  client_profile_id,
  lifecycle_status,
  current_tier,
  current_phase,
  estimated_value,
  actual_revenue
)
SELECT
  COALESCE(NULLIF(TRIM(p.company_name), ''), NULLIF(TRIM(p.full_name), ''), 'Client'),
  p.id,
  'Active',
  'Growth Program',
  1,
  0,
  0
FROM public.profiles p
WHERE p.role = 'client'
  AND NOT EXISTS (
    SELECT 1 FROM public.workspaces w WHERE w.client_profile_id = p.id
  );

UPDATE public.profiles pr
SET workspace_id = w.id
FROM public.workspaces w
WHERE w.client_profile_id = pr.id
  AND pr.workspace_id IS DISTINCT FROM w.id;

INSERT INTO public.workspace_members (workspace_id, user_id, member_role)
SELECT w.id, w.client_profile_id, 'client'
FROM public.workspaces w
WHERE w.client_profile_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.brand_hubs (client_id)
SELECT p.id
FROM public.profiles p
WHERE p.role = 'client'
  AND NOT EXISTS (SELECT 1 FROM public.brand_hubs b WHERE b.client_id = p.id);

INSERT INTO public.client_delivery_gates (client_id)
SELECT p.id
FROM public.profiles p
WHERE p.role = 'client'
  AND NOT EXISTS (SELECT 1 FROM public.client_delivery_gates g WHERE g.client_id = p.id);
