-- Process steps + delivery tasks aligned with Inventory Radar

-- Delivery task types
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
UPDATE public.tasks SET task_type = 'Internal Milestone'
  WHERE task_type IN ('Internal File', 'Link', 'Milestone');
UPDATE public.tasks SET task_type = 'Deliverable' WHERE task_type IS NULL OR task_type = '';
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('Deliverable', 'Contract', 'Internal Milestone'));

-- Process steps: link to inventory resources + cost buffer
ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS linked_resource_id UUID REFERENCES public.resources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_buffer_percent INT NOT NULL DEFAULT 0
    CHECK (cost_buffer_percent >= 0 AND cost_buffer_percent <= 200);

CREATE INDEX IF NOT EXISTS idx_process_steps_resource ON public.process_steps(linked_resource_id);

-- Backfill resource links from legacy line-item names
UPDATE public.process_steps ps
SET linked_resource_id = r.id
FROM public.resources r
WHERE ps.linked_resource_id IS NULL
  AND ps.default_unit_cost_name IS NOT NULL
  AND ps.default_unit_cost_name = r.resource_name;

-- Recompute cached unit cost from resource + buffer
UPDATE public.process_steps ps
SET default_unit_cost_amount = ROUND(
  (r.cost_amount * (1 + ps.cost_buffer_percent::numeric / 100))::numeric, 2
)
FROM public.resources r
WHERE ps.linked_resource_id = r.id;

-- Template overhead uses buffered resource costs
CREATE OR REPLACE FUNCTION public.refresh_process_template_metrics(p_template_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.process_templates t
  SET
    total_duration_days = COALESCE((
      SELECT SUM(COALESCE(s.duration_days, 0))::INT
      FROM public.process_steps s
      WHERE s.template_id = p_template_id
    ), 0),
    template_base_cost = COALESCE((
      SELECT SUM(
        CASE
          WHEN s.linked_resource_id IS NOT NULL AND r.id IS NOT NULL THEN
            r.cost_amount * (1 + s.cost_buffer_percent::numeric / 100)
          ELSE COALESCE(s.default_unit_cost_amount, 0)
        END
      )
      FROM public.process_steps s
      LEFT JOIN public.resources r ON r.id = s.linked_resource_id
      WHERE s.template_id = p_template_id
        AND s.default_unit_cost_is_billable
        AND (
          s.linked_resource_id IS NOT NULL
          OR COALESCE(s.default_unit_cost_amount, 0) > 0
        )
    ), 0),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE t.id = p_template_id;
END;
$$;
