-- Link HR compensation & overhead lines to projects for project cost visibility.
-- Bidirectional: person form → project; task assign → project-scoped compensation.

ALTER TABLE public.compensation_records
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS compensation_records_project_id_idx
  ON public.compensation_records (project_id);

COMMENT ON COLUMN public.compensation_records.project_id IS
  'Optional project this compensation is attributed to (hourly / per-project fees).';

ALTER TABLE public.person_overhead_costs
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS person_overhead_costs_project_id_idx
  ON public.person_overhead_costs (project_id);

COMMENT ON COLUMN public.person_overhead_costs.project_id IS
  'Optional project this overhead cost is attributed to.';
