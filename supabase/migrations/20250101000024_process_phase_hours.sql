-- Phase-level labor hours rollup (sum of task duration_hours in task_components)
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS duration_hours INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.process_steps.duration_hours IS 'Sum of template task hours in this phase; used with People hourly rates.';
