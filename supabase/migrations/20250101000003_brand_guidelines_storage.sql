-- Source uploads + public asset bucket for brand guidelines
ALTER TABLE public.brand_hubs
  ADD COLUMN IF NOT EXISTS guideline_source_path TEXT DEFAULT NULL;

COMMENT ON COLUMN public.brand_hubs.guideline_source_path IS
  'Storage path in brand-guidelines bucket for the last uploaded source file (PDF, etc.).';

-- Bucket: public read so getPublicUrl works for portal previews without signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('brand-guidelines', 'brand-guidelines', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

-- Storage RLS: world can read; only admins can write (upload/update/delete).
DROP POLICY IF EXISTS "brand_guidelines_public_read" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "brand_guidelines_admin_delete" ON storage.objects;

CREATE POLICY "brand_guidelines_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-guidelines');

CREATE POLICY "brand_guidelines_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "brand_guidelines_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  );

CREATE POLICY "brand_guidelines_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'brand-guidelines'
    AND public.get_user_role() = 'admin'
  );
