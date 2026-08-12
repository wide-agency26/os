-- Perf: wrap auth.uid() so RLS policies init once per statement
DROP POLICY IF EXISTS "Users read own staff notifications" ON public.staff_notifications;
CREATE POLICY "Users read own staff notifications" ON public.staff_notifications
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users update own staff notifications" ON public.staff_notifications;
CREATE POLICY "Users update own staff notifications" ON public.staff_notifications
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users delete own staff notifications" ON public.staff_notifications;
CREATE POLICY "Users delete own staff notifications" ON public.staff_notifications
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- Speed on-hold reminder dedupe + timeline fetches
CREATE INDEX IF NOT EXISTS bd_timeline_record_action_created_idx
  ON public.bd_timeline_entries (bd_record_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS bd_records_stage_sort_idx
  ON public.bd_records (stage, sort_order, updated_at DESC);
