-- =============================================================================
-- Restore vault_files + portal_activity columns the Next.js app expects.
-- A later "restore operational ecosystem" migration recreated a stripped vault
-- schema; this brings the live DB back in line with app/actions + lib/cm.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- portal_activity: kind/summary/metadata → event_type/title/meta
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_activity' AND column_name = 'kind'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_activity' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE public.portal_activity RENAME COLUMN kind TO event_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_activity' AND column_name = 'summary'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_activity' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.portal_activity RENAME COLUMN summary TO title;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_activity' AND column_name = 'metadata'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'portal_activity' AND column_name = 'meta'
  ) THEN
    ALTER TABLE public.portal_activity RENAME COLUMN metadata TO meta;
  END IF;
END $$;

ALTER TABLE public.portal_activity
  ALTER COLUMN meta SET DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- vault_files: restore rich file-manager columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.vault_files
  ADD COLUMN IF NOT EXISTS folder_key TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS external_provider TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS replaces_file_id UUID,
  ADD COLUMN IF NOT EXISTS is_legal BOOLEAN NOT NULL DEFAULT false;

-- Backfill from stripped schema fields
UPDATE public.vault_files
SET
  file_name = COALESCE(NULLIF(file_name, ''), original_filename, 'file'),
  label = COALESCE(NULLIF(label, ''), original_filename, file_name, 'File')
WHERE label IS NULL OR file_name IS NULL;

ALTER TABLE public.vault_files
  ALTER COLUMN file_name SET NOT NULL,
  ALTER COLUMN label SET NOT NULL;

ALTER TABLE public.vault_files
  ALTER COLUMN storage_path DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vault_files_replaces_file_id_fkey'
  ) THEN
    ALTER TABLE public.vault_files
      ADD CONSTRAINT vault_files_replaces_file_id_fkey
      FOREIGN KEY (replaces_file_id) REFERENCES public.vault_files(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.vault_files DROP CONSTRAINT IF EXISTS vault_files_storage_or_external;
ALTER TABLE public.vault_files ADD CONSTRAINT vault_files_storage_or_external CHECK (
  (
    external_url IS NULL
    AND storage_path IS NOT NULL
    AND length(trim(storage_path)) > 0
  )
  OR (
    storage_path IS NULL
    AND external_url IS NOT NULL
    AND length(trim(external_url)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_files_client_folder
  ON public.vault_files(client_id, folder_key);
CREATE INDEX IF NOT EXISTS idx_vault_files_client_current
  ON public.vault_files(client_id, is_current) WHERE is_current = true;

NOTIFY pgrst, 'reload schema';
