-- Optional demo data after FULL_SETUP.sql and at least one CLIENT user exists.
-- Replace :client_id with a real UUID from: SELECT id, email FROM auth.users;
-- (Use a user that has role = 'client' in public.profiles.)

-- Example:
-- INSERT INTO public.projects (client_id, title, scope, status, start_date, end_date, deliverables, milestones)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'Brand identity refresh',
--   'Logo system, palette, typography, and living guidelines in the portal.',
--   'running',
--   CURRENT_DATE,
--   CURRENT_DATE + 90,
--   '[
--     {"name": "Logo system (primary + alternates)", "done": true},
--     {"name": "Color & type tokens", "done": true},
--     {"name": "Brand guidelines (portal)", "done": false},
--     {"name": "Social templates", "done": false}
--   ]'::jsonb,
--   NULL
-- );

SELECT 'Edit this file: paste a real client_id from auth.users, then run the INSERT.' AS hint;
