-- Brand guideline document (structured JSON for AI + admin-edited living guidelines)
ALTER TABLE public.brand_hubs
  ADD COLUMN IF NOT EXISTS guideline_document JSONB DEFAULT NULL;

COMMENT ON COLUMN public.brand_hubs.guideline_document IS
  'Structured brand guideline sections (hero, logos, colors, type, voice, etc.) for portal rendering.';
