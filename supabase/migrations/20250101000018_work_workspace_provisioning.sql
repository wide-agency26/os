-- Work module: provisioning fields & forecast/alliance row kinds

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS workspace_kind TEXT NOT NULL DEFAULT 'pipeline'
    CHECK (workspace_kind IN ('delivery', 'pipeline', 'forecast', 'alliance')),
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS billing_sequence TEXT DEFAULT 'one_time'
    CHECK (billing_sequence IN ('one_time', 'monthly', 'quarterly', 'annual')),
  ADD COLUMN IF NOT EXISTS wizard_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workspaces_kind ON public.workspaces(workspace_kind);
CREATE INDEX IF NOT EXISTS idx_workspaces_lifecycle ON public.workspaces(lifecycle_status);

COMMENT ON COLUMN public.workspaces.workspace_kind IS
  'pipeline=deal in motion, delivery=active client work, forecast=standalone P&L row, alliance=partner/vendor';
