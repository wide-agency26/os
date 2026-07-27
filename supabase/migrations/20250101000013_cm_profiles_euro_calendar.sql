-- =============================================================================
-- CM public profiles (contact + Google Calendar) · rename calendly on profiles
-- Migration: 012_cm_profiles_euro_calendar.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.client_manager_profiles (
  user_id                     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title                   TEXT,
  bio                         TEXT,
  public_email                TEXT,
  phone                       TEXT,
  google_calendar_meeting_url TEXT,
  linkedin_url                TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_manager_profiles IS
  'Client-facing CM contact card — meeting link, bio, and reach-out details.';

-- Migrate legacy calendly_url from profiles when that column exists (011 optional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'calendly_url'
  ) THEN
    INSERT INTO public.client_manager_profiles (user_id, google_calendar_meeting_url)
    SELECT p.id, NULLIF(TRIM(p.calendly_url), '')
    FROM public.profiles p
    WHERE p.role IN ('client_manager', 'admin', 'superadmin')
      AND p.calendly_url IS NOT NULL
      AND TRIM(p.calendly_url) <> ''
    ON CONFLICT (user_id) DO UPDATE
      SET google_calendar_meeting_url = COALESCE(
        NULLIF(TRIM(EXCLUDED.google_calendar_meeting_url), ''),
        public.client_manager_profiles.google_calendar_meeting_url
      );
    ALTER TABLE public.profiles DROP COLUMN calendly_url;
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_client_manager_profiles_updated_at ON public.client_manager_profiles;
CREATE TRIGGER set_client_manager_profiles_updated_at
  BEFORE UPDATE ON public.client_manager_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.client_manager_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full cm profiles" ON public.client_manager_profiles;
CREATE POLICY "Superadmin full cm profiles"
  ON public.client_manager_profiles FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "CM manage own profile" ON public.client_manager_profiles;
CREATE POLICY "CM manage own profile"
  ON public.client_manager_profiles FOR ALL
  USING (user_id = auth.uid() AND public.is_client_manager())
  WITH CHECK (user_id = auth.uid() AND public.is_client_manager());

DROP POLICY IF EXISTS "Clients read assigned cm profiles" ON public.client_manager_profiles;
CREATE POLICY "Clients read assigned cm profiles"
  ON public.client_manager_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.client_manager_assignments a
      WHERE a.manager_id = client_manager_profiles.user_id
        AND a.client_id = public.effective_client_id()
    )
  );

DROP POLICY IF EXISTS "Agency staff read cm profiles" ON public.client_manager_profiles;
CREATE POLICY "Agency staff read cm profiles"
  ON public.client_manager_profiles FOR SELECT
  USING (public.is_agency_staff());

GRANT ALL ON TABLE public.client_manager_profiles TO postgres, anon, authenticated, service_role;
