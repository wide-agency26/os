-- Unique inbound email aliases per project (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS projects_pm_inbound_email_unique
  ON public.projects (lower(pm_inbound_email))
  WHERE pm_inbound_email IS NOT NULL AND btrim(pm_inbound_email) <> '';
