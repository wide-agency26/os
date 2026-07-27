-- React Flow canvas layout telemetry (visual overlay only — no data model changes)

ALTER TABLE public.process_steps
  ADD COLUMN IF NOT EXISTS node_position_x NUMERIC DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS node_position_y NUMERIC DEFAULT 0.0;

COMMENT ON COLUMN public.process_steps.node_position_x IS 'React Flow canvas X coordinate for process mapper.';
COMMENT ON COLUMN public.process_steps.node_position_y IS 'React Flow canvas Y coordinate for process mapper.';

-- Package composed-node positions (virtual nodes keyed by composed id)
ALTER TABLE public.process_templates
  ADD COLUMN IF NOT EXISTS canvas_layout JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.process_templates.canvas_layout IS 'JSON map of composed node id → {x,y} for package flow canvas.';
