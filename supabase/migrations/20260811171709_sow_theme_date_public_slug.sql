-- SOW: document date, theme, public share slug, portfolio caption
ALTER TABLE public.sows
  ADD COLUMN IF NOT EXISTS document_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{
    "fontFamily": "Syne",
    "background": "#0A0A0A",
    "text": "#FFFFFF",
    "mutedText": "rgba(255,255,255,0.62)",
    "accent": "#FFFFFF",
    "cardBg": "rgba(255,255,255,0.04)",
    "border": "rgba(255,255,255,0.12)"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS public_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS sows_public_slug_uidx
  ON public.sows (public_slug)
  WHERE public_slug IS NOT NULL;

ALTER TABLE public.sow_portfolio_slides
  ADD COLUMN IF NOT EXISTS caption TEXT;

NOTIFY pgrst, 'reload schema';
