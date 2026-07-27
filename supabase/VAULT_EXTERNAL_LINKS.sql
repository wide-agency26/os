-- Incremental: vault files can reference Google Drive / Workspace (or any https link).
-- Run once if you already applied FEATURES_EXTENSION before external link support.

ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS external_provider TEXT;
ALTER TABLE public.vault_files ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.vault_files DROP CONSTRAINT IF EXISTS vault_files_storage_or_external;
ALTER TABLE public.vault_files ADD CONSTRAINT vault_files_storage_or_external CHECK (
  (
    external_url IS NULL
    AND storage_path IS NOT NULL
    AND length(trim(storage_path)) > 0
  )
  OR (
    external_url IS NOT NULL
    AND length(trim(external_url)) > 0
    AND trim(external_url) LIKE 'https://%'
  )
);

SELECT 'VAULT_EXTERNAL_LINKS applied.' AS note;
