-- Structured playbook (editable sections) for website style guide imports
ALTER TABLE public.web_style_guide_snapshots
  ADD COLUMN IF NOT EXISTS style_guide_document JSONB;

COMMENT ON COLUMN public.web_style_guide_snapshots.style_guide_document IS
  'Parsed Flowkit HTML as editable sections; when set, html_fragment may be empty.';
