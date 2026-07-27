-- Richer profiles on signup + optional project planning fields (milestones / deliverables)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, company_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'company_name', '')), '')
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deliverables JSONB DEFAULT NULL;

COMMENT ON COLUMN public.projects.milestones IS
  'Optional phases: [{ "phase": string, "status": "completed"|"active"|"upcoming", "dates": string }]';

COMMENT ON COLUMN public.projects.deliverables IS
  'Optional checklist: [{ "name": string, "done": boolean }]';

-- Bootstrap your first agency admin (run once in SQL editor after your user exists in auth.users):
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<your-auth-user-uuid>';
