-- Client requests: service intake + executive responses
-- Prospects: link to client profile when converted

ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS service TEXT,
  ADD COLUMN IF NOT EXISTS form_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_response_date DATE,
  ADD COLUMN IF NOT EXISTS response_note TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospects_client_profile
  ON public.prospects(client_profile_id)
  WHERE client_profile_id IS NOT NULL;
