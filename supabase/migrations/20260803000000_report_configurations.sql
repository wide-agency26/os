-- Migration: report_configurations — maps clients to their cloned Superset dashboards
-- This is the bridge between the WIDE OS project layer and Apache Superset.

CREATE TABLE IF NOT EXISTS public.report_configurations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_tier            TEXT NOT NULL DEFAULT 'launch'
                          CHECK (package_tier IN ('mvb','launch','growth','full_partnership')),
  superset_dashboard_id   INTEGER NOT NULL,
  superset_dashboard_uuid TEXT,
  superset_dashboard_slug TEXT,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  provisioned_by          UUID REFERENCES public.profiles(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, package_tier)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_config_client
  ON public.report_configurations(client_id, is_active);

-- RLS
ALTER TABLE public.report_configurations ENABLE ROW LEVEL SECURITY;

-- Founders: full CRUD
CREATE POLICY "founders_full_access" ON public.report_configurations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('superadmin','admin','client_manager','accountant','bd_manager','hr_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('superadmin','admin','client_manager','accountant','bd_manager','hr_manager')
    )
  );

-- Clients: read their own active configs only
CREATE POLICY "clients_read_own" ON public.report_configurations
  FOR SELECT
  USING (
    client_id = auth.uid() AND is_active = true
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_report_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_configurations_updated_at
  BEFORE UPDATE ON public.report_configurations
  FOR EACH ROW EXECUTE FUNCTION public.set_report_config_updated_at();
