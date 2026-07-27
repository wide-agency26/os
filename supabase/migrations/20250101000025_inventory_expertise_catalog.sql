-- Dynamic expertise tracks (Inventory → assign to people → process tasks)

CREATE TABLE IF NOT EXISTS public.expertise_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_expertise_tracks_active ON public.expertise_tracks(is_active, sort_order);

ALTER TABLE public.expertise_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin expertise_tracks" ON public.expertise_tracks;
CREATE POLICY "Superadmin expertise_tracks" ON public.expertise_tracks
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Authenticated read expertise_tracks" ON public.expertise_tracks;
CREATE POLICY "Authenticated read expertise_tracks" ON public.expertise_tracks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Seed from process service catalog when present
INSERT INTO public.expertise_tracks (slug, label, sort_order)
SELECT s.slug, s.name, s.sort_order
FROM public.process_services s
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  updated_at = TIMEZONE('utc'::text, NOW());
