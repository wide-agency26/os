-- =============================================================================
-- WIDE OS — People & capacity engine extensions
-- Migration: 20250101000021_people_capacity_engine.sql
-- =============================================================================

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS primary_email TEXT,
  ADD COLUMN IF NOT EXISTS communication_handle TEXT,
  ADD COLUMN IF NOT EXISTS salary_base NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS max_weekly_hours INT NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS target_load_ceiling INT NOT NULL DEFAULT 85
    CHECK (target_load_ceiling BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS ica_document_path TEXT,
  ADD COLUMN IF NOT EXISTS nda_document_path TEXT,
  ADD COLUMN IF NOT EXISTS compliance_document_path TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());

-- Re-assert person_type / availability checks (idempotent)
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_person_type_check;
ALTER TABLE public.people ADD CONSTRAINT people_person_type_check
  CHECK (person_type IN ('Founder', 'Employee', 'Intern', 'Freelancer', 'Partner_Contact'));

ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_availability_status_check;
ALTER TABLE public.people ADD CONSTRAINT people_availability_status_check
  CHECK (availability_status IN ('Available', 'Busy'));

ALTER TABLE public.workspace_assignments
  ADD COLUMN IF NOT EXISTS process_step_id UUID REFERENCES public.process_steps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hours_per_week NUMERIC(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS package_track TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_workspace_assignments_step ON public.workspace_assignments(process_step_id);
CREATE INDEX IF NOT EXISTS idx_workspace_assignments_due ON public.workspace_assignments(due_date);

-- Capacity score = live utilization % (recomputed from assignments)
CREATE OR REPLACE FUNCTION public.recompute_person_capacity_score(p_person_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_hours INT;
  v_assigned NUMERIC;
  v_util INT;
BEGIN
  SELECT COALESCE(max_weekly_hours, 40) INTO v_max_hours FROM public.people WHERE id = p_person_id;
  IF v_max_hours <= 0 THEN v_max_hours := 40; END IF;

  SELECT COALESCE(SUM(hours_per_week), 0) INTO v_assigned
  FROM public.workspace_assignments
  WHERE person_id = p_person_id;

  v_util := LEAST(100, GREATEST(0, ROUND((v_assigned / v_max_hours) * 100)::INT));

  UPDATE public.people
  SET capacity_score = v_util, updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_person_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_capacity_on_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_person_capacity_score(OLD.person_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_person_capacity_score(NEW.person_id);
  IF TG_OP = 'UPDATE' AND OLD.person_id IS DISTINCT FROM NEW.person_id THEN
    PERFORM public.recompute_person_capacity_score(OLD.person_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_assignment_capacity ON public.workspace_assignments;
CREATE TRIGGER trg_workspace_assignment_capacity
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_capacity_on_assignment();

DROP TRIGGER IF EXISTS set_people_updated_at ON public.people;
CREATE TRIGGER set_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

GRANT EXECUTE ON FUNCTION public.recompute_person_capacity_score(UUID) TO authenticated, service_role;

-- Legal document storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'people-legal',
  'people-legal',
  false,
  52428800,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Superadmin people legal upload" ON storage.objects;
CREATE POLICY "Superadmin people legal upload" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'people-legal' AND public.is_superadmin())
  WITH CHECK (bucket_id = 'people-legal' AND public.is_superadmin());
