-- DAG edge map for non-linear process builder (visual graph overlay)

CREATE TABLE IF NOT EXISTS public.process_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.process_templates(id) ON DELETE CASCADE,
  source_step_id UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  target_step_id UUID NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE (template_id, source_step_id, target_step_id)
);

CREATE INDEX IF NOT EXISTS idx_process_edges_template ON public.process_edges(template_id);
CREATE INDEX IF NOT EXISTS idx_process_edges_source ON public.process_edges(source_step_id);
CREATE INDEX IF NOT EXISTS idx_process_edges_target ON public.process_edges(target_step_id);

COMMENT ON TABLE public.process_edges IS 'Directed edges between process_steps — supports parallel branches in the flow canvas.';

-- Backfill linear sort_order chains into edge rows (preserves existing playbook data)
DO $$
DECLARE
  rec RECORD;
  prev_id UUID;
  curr_template UUID;
BEGIN
  FOR rec IN
    SELECT id, template_id
    FROM public.process_steps
    ORDER BY template_id, sort_order
  LOOP
    IF curr_template IS NULL OR rec.template_id <> curr_template THEN
      curr_template := rec.template_id;
      prev_id := rec.id;
    ELSE
      INSERT INTO public.process_edges (template_id, source_step_id, target_step_id)
      VALUES (rec.template_id, prev_id, rec.id)
      ON CONFLICT (template_id, source_step_id, target_step_id) DO NOTHING;
      prev_id := rec.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.process_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin process_edges" ON public.process_edges;
CREATE POLICY "Superadmin process_edges" ON public.process_edges
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read process_edges" ON public.process_edges;
CREATE POLICY "Authenticated read process_edges" ON public.process_edges
  FOR SELECT USING (auth.role() = 'authenticated');
