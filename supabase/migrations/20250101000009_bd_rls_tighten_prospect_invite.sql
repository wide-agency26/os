-- =============================================================================
-- WIDE OS — Tighter BD prospect RLS + prospect signup metadata
-- Migration: 008_bd_rls_tighten_prospect_invite.sql
-- =============================================================================

-- BD managers only see prospects they own (superadmin sees all via is_superadmin).
CREATE OR REPLACE FUNCTION public.can_access_prospect(target_prospect_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_prospect_id IS NULL THEN false
    WHEN public.is_superadmin() THEN true
    WHEN public.get_user_role() = 'bd_manager' THEN (
      EXISTS (
        SELECT 1 FROM public.prospects p
        WHERE p.id = target_prospect_id
          AND p.lead_admin_id = auth.uid()
      )
    )
    WHEN public.get_user_role() = 'prospect' THEN (
      EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.prospect_id = target_prospect_id
      )
    )
    ELSE false
  END;
$$;

DROP POLICY IF EXISTS "BD staff manage prospects" ON public.prospects;
CREATE POLICY "BD staff manage assigned prospects"
  ON public.prospects FOR ALL
  USING (
    public.is_superadmin()
    OR (public.get_user_role() = 'bd_manager' AND public.can_access_prospect(id))
  )
  WITH CHECK (
    public.is_superadmin()
    OR (public.get_user_role() = 'bd_manager' AND public.can_access_prospect(id))
  );

DROP POLICY IF EXISTS "BD staff manage prospect_proposals" ON public.prospect_proposals;
CREATE POLICY "BD staff manage assigned prospect_proposals"
  ON public.prospect_proposals FOR ALL
  USING (
    public.is_superadmin()
    OR (public.get_user_role() = 'bd_manager' AND public.can_access_prospect(prospect_id))
  )
  WITH CHECK (
    public.is_superadmin()
    OR (public.get_user_role() = 'bd_manager' AND public.can_access_prospect(prospect_id))
  );

-- Apply portal_role + prospect_id from invite metadata on first profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meta_role TEXT;
  meta_prospect UUID;
BEGIN
  meta_role := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'portal_role', '')), '');
  BEGIN
    meta_prospect := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'prospect_id', '')), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    meta_prospect := NULL;
  END;

  INSERT INTO public.profiles (id, full_name, company_name, role, prospect_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data ->> 'company_name', '')), ''),
    CASE
      WHEN meta_role IN (
        'superadmin', 'accountant', 'bd_manager', 'client_manager',
        'client', 'prospect', 'hr_manager', 'admin'
      ) THEN
        CASE WHEN meta_role = 'admin' THEN 'superadmin' ELSE meta_role END
      ELSE 'client'
    END,
    meta_prospect
  );
  RETURN NEW;
END;
$$;
