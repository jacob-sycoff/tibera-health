-- Add user goal event history (micronutrients/macros)
-- Idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS public.user_goal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('micronutrient_set', 'micronutrient_remove', 'macros_saved')),
  nutrient_key TEXT,
  amount NUMERIC,
  unit TEXT,
  prev_amount NUMERIC,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_goal_events_user ON public.user_goal_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_goal_events_nutrient ON public.user_goal_events(user_id, nutrient_key, created_at DESC);

ALTER TABLE public.user_goal_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_goal_events'
      AND policyname = 'Users can manage own goal events'
  ) THEN
    CREATE POLICY "Users can manage own goal events" ON public.user_goal_events
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_goal_events'
      AND policyname = 'demo_user_goal_events_all'
  ) THEN
    CREATE POLICY "demo_user_goal_events_all" ON public.user_goal_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

