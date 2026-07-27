-- Finance role: read prospects, proposals, projects, and client profiles for reporting.

CREATE POLICY "Accountant read prospects"
  ON public.prospects FOR SELECT
  USING (public.get_user_role() = 'accountant' OR public.is_superadmin());

CREATE POLICY "Accountant read prospect_proposals"
  ON public.prospect_proposals FOR SELECT
  USING (public.get_user_role() = 'accountant' OR public.is_superadmin());

CREATE POLICY "Accountant read projects"
  ON public.projects FOR SELECT
  USING (public.get_user_role() = 'accountant' OR public.is_superadmin());

CREATE POLICY "Accountant read client profiles"
  ON public.profiles FOR SELECT
  USING (
    public.get_user_role() = 'accountant'
    AND role = 'client'
  );
