-- Dataset upload versioning: keep prior uploads for static snapshot comparison
ALTER TABLE public.datasets
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_datasets_project_sub_current
  ON public.datasets (project_id, subcategory, is_current)
  WHERE subcategory IS NOT NULL;

COMMENT ON COLUMN public.datasets.is_current IS
  'Latest upload for this project+subcategory stream. Prior uploads kept for static snapshot comparison.';
COMMENT ON COLUMN public.datasets.supersedes_id IS
  'Previous dataset this upload replaced (same project + subcategory).';
