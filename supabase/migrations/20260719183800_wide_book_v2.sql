TRUNCATE TABLE public.brand_books;

ALTER TABLE public.brand_books 
  DROP COLUMN IF EXISTS strategy_data,
  DROP COLUMN IF EXISTS visibility_settings,
  DROP COLUMN IF EXISTS token_colors,
  DROP COLUMN IF EXISTS token_typography,
  DROP COLUMN IF EXISTS assets_logos;

ALTER TABLE public.brand_books 
  RENAME COLUMN client_name TO project_title;

ALTER TABLE public.brand_books 
  ADD COLUMN client_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN canvas_blocks JSONB DEFAULT '[]'::jsonb;
