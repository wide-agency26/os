-- Additive: BlockNote document JSON for PM tasks (description kept as plain-text summary)
ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS content_blocks JSONB;

COMMENT ON COLUMN public.pm_tasks.content_blocks IS
  'BlockNote editor document (JSON array of blocks). description remains a plain-text summary for search/email.';
