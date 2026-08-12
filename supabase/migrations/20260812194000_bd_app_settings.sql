-- Phase 9–11 support: app settings (Opportunity Finder config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage app_settings" ON public.app_settings;
CREATE POLICY "Staff manage app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager','superadmin','admin'))
  WITH CHECK (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager','superadmin','admin'));
