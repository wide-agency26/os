-- Align with app: file_name/label are canonical; original_filename is legacy optional.
ALTER TABLE public.vault_files ALTER COLUMN original_filename DROP NOT NULL;
ALTER TABLE public.vault_files ALTER COLUMN original_filename SET DEFAULT '';
