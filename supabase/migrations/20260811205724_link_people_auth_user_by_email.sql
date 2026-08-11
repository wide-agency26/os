-- Link HR roster people to portal logins by matching primary_email ↔ auth.users.email.
-- Then mirror auth_user_id onto pm_tasks.assignee_id so My Week / RLS stay in sync.

UPDATE public.people p
SET
  auth_user_id = u.id,
  updated_at = timezone('utc'::text, now())
FROM auth.users u
WHERE p.auth_user_id IS NULL
  AND p.primary_email IS NOT NULL
  AND lower(trim(p.primary_email)) = lower(trim(u.email));

UPDATE public.pm_tasks t
SET
  assignee_id = p.auth_user_id,
  updated_at = timezone('utc'::text, now())
FROM public.people p
WHERE t.assignee_person_id = p.id
  AND p.auth_user_id IS NOT NULL
  AND (t.assignee_id IS NULL OR t.assignee_id IS DISTINCT FROM p.auth_user_id);

CREATE OR REPLACE FUNCTION public.link_person_to_auth_by_email(p_person_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth uuid;
  v_email text;
BEGIN
  SELECT primary_email, auth_user_id INTO v_email, v_auth
  FROM public.people
  WHERE id = p_person_id;

  IF v_auth IS NOT NULL THEN
    RETURN v_auth;
  END IF;
  IF v_email IS NULL OR length(trim(v_email)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT u.id INTO v_auth
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(v_email))
  LIMIT 1;

  IF v_auth IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.people
  SET auth_user_id = v_auth, updated_at = timezone('utc'::text, now())
  WHERE id = p_person_id
    AND auth_user_id IS NULL;

  RETURN v_auth;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_person_to_auth_by_email(uuid) TO authenticated, service_role;
