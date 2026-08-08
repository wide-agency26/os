-- Wire PM task assignment to HR roster people (additive).
-- Keeps assignee_id (profiles) in sync for My Week / RLS when person has a login.

ALTER TABLE public.pm_tasks
  ADD COLUMN IF NOT EXISTS assignee_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pm_tasks_assignee_person_id_idx
  ON public.pm_tasks (assignee_person_id);

COMMENT ON COLUMN public.pm_tasks.assignee_person_id IS
  'HR roster person (people.id). Primary assignment key. assignee_id mirrors auth_user_id when present.';

-- Backfill from linked auth users
UPDATE public.pm_tasks t
SET assignee_person_id = p.id
FROM public.people p
WHERE t.assignee_person_id IS NULL
  AND t.assignee_id IS NOT NULL
  AND p.auth_user_id = t.assignee_id;
