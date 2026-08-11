-- Ghost ledger rows: project delete used ON DELETE SET NULL, leaving auto_project orphans.
-- Cascade project deletes into ledger, and wipe existing orphans.

DELETE FROM public.ledger_entries
WHERE source = 'auto_project'
  AND (
    project_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = ledger_entries.project_id
    )
  );

ALTER TABLE public.ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_project_id_fkey;

ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_entries_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE CASCADE;
