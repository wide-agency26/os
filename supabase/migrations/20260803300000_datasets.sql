-- =============================================================================
-- WIDE Portal — Flexible Dataset Storage
-- Migration: 20260803300000_datasets.sql
-- =============================================================================

-- 1. datasets — metadata for each uploaded file
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                          -- original filename or user-given name
  category TEXT NOT NULL DEFAULT 'General',    -- Social, Digital, Website, Content, General
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of { key, label, type, sample_values }
  row_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_datasets_project_id ON public.datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_datasets_category ON public.datasets(category);

ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own project datasets"
  ON public.datasets
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to datasets"
  ON public.datasets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- 2. dataset_rows — one row per CSV row, stored as JSONB
CREATE TABLE IF NOT EXISTS public.dataset_rows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
  row_index INTEGER NOT NULL,
  row_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON public.dataset_rows(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_rows_data ON public.dataset_rows USING GIN (row_data);

-- Unique constraint: one row_index per dataset (for upsert / re-upload)
ALTER TABLE public.dataset_rows
  ADD CONSTRAINT dataset_rows_unique_index UNIQUE (dataset_id, row_index);

ALTER TABLE public.dataset_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own dataset rows"
  ON public.dataset_rows
  FOR SELECT
  USING (
    dataset_id IN (
      SELECT d.id FROM public.datasets d
      JOIN public.projects p ON d.project_id = p.id
      WHERE p.client_id = auth.uid()
    )
  );

CREATE POLICY "Admins have full access to dataset rows"
  ON public.dataset_rows
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );
