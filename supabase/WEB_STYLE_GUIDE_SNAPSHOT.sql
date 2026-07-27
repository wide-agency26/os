-- Incremental migration: Flowkit / full-page web style guide snapshots (run after FEATURES_EXTENSION.sql).
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.web_style_guide_snapshots (
  client_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_class          TEXT NOT NULL DEFAULT '',
  html_fragment       TEXT NOT NULL DEFAULT '',
  stylesheet_hrefs    JSONB NOT NULL DEFAULT '[]'::jsonb,
  inline_head_styles  TEXT NOT NULL DEFAULT '',
  pdf_notes           TEXT,
  source_filename     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_style_guide_snapshots_updated
  ON public.web_style_guide_snapshots(updated_at DESC);

DROP TRIGGER IF EXISTS set_web_style_guide_snapshots_updated_at ON public.web_style_guide_snapshots;
CREATE TRIGGER set_web_style_guide_snapshots_updated_at
  BEFORE UPDATE ON public.web_style_guide_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.web_style_guide_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full web_style_guide_snapshots" ON public.web_style_guide_snapshots;
DROP POLICY IF EXISTS "Clients read own web_style_guide_snapshots" ON public.web_style_guide_snapshots;

CREATE POLICY "Admins full web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR ALL
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Clients read own web_style_guide_snapshots"
  ON public.web_style_guide_snapshots FOR SELECT
  USING (client_id = public.effective_client_id());

GRANT ALL ON TABLE public.web_style_guide_snapshots TO postgres, anon, authenticated, service_role;

SELECT 'WEB_STYLE_GUIDE_SNAPSHOT applied.' AS note;
