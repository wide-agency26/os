-- Phase 7: staff notifications + proposal response support
CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  severity TEXT NOT NULL DEFAULT 'Info'
    CHECK (severity IN ('Info', 'Success', 'Warning', 'Critical')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_notifications_user_id_idx
  ON public.staff_notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own staff notifications" ON public.staff_notifications;
CREATE POLICY "Users read own staff notifications" ON public.staff_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own staff notifications" ON public.staff_notifications;
CREATE POLICY "Users update own staff notifications" ON public.staff_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own staff notifications" ON public.staff_notifications;
CREATE POLICY "Users delete own staff notifications" ON public.staff_notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Service role inserts; staff cannot insert for others via RLS (no insert policy).
