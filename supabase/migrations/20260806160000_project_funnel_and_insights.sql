-- Project-scoped funnel mapping + AI insight cards for Reports hub

CREATE TABLE IF NOT EXISTS public.project_funnel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS public.project_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Funnel',
  title TEXT NOT NULL,
  impact TEXT NOT NULL DEFAULT 'medium'
    CHECK (impact IN ('high', 'medium', 'positive', 'attention')),
  observation TEXT NOT NULL DEFAULT '',
  recommended_action TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT false,
  visible BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'manual')),
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_ai_insights_project_idx
  ON public.project_ai_insights (project_id, pinned DESC, sort_order ASC);

ALTER TABLE public.project_funnel_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth manage funnel configs" ON public.project_funnel_configs;
CREATE POLICY "Auth manage funnel configs" ON public.project_funnel_configs
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth manage ai insights" ON public.project_ai_insights;
CREATE POLICY "Auth manage ai insights" ON public.project_ai_insights
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_funnel_configs_updated ON public.project_funnel_configs;
CREATE TRIGGER trg_project_funnel_configs_updated
  BEFORE UPDATE ON public.project_funnel_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_project_ai_insights_updated ON public.project_ai_insights;
CREATE TRIGGER trg_project_ai_insights_updated
  BEFORE UPDATE ON public.project_ai_insights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

GRANT ALL ON public.project_funnel_configs TO authenticated;
GRANT ALL ON public.project_ai_insights TO authenticated;
GRANT ALL ON public.project_funnel_configs TO service_role;
GRANT ALL ON public.project_ai_insights TO service_role;
