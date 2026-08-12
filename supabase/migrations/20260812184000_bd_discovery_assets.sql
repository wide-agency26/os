-- BD discovery call assets bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bd-discovery',
  'bd-discovery',
  true,
  52428800,
  ARRAY[
    'audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/x-m4a',
    'text/plain','application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Staff upload bd discovery" ON storage.objects;
CREATE POLICY "Staff upload bd discovery" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bd-discovery' AND (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager','hr_manager')));

DROP POLICY IF EXISTS "Staff update bd discovery" ON storage.objects;
CREATE POLICY "Staff update bd discovery" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'bd-discovery' AND (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager','hr_manager')));

DROP POLICY IF EXISTS "Staff read bd discovery" ON storage.objects;
CREATE POLICY "Staff read bd discovery" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bd-discovery' AND (public.is_agency_staff() OR public.get_user_role() IN ('bd_manager','hr_manager')));

DROP POLICY IF EXISTS "Public read bd discovery" ON storage.objects;
CREATE POLICY "Public read bd discovery" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'bd-discovery');
