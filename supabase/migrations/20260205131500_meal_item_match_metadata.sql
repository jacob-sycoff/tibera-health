-- Store original user/AI label and matched USDA metadata per meal item, plus an audit table for match history.
-- Idempotent: safe to run multiple times.

ALTER TABLE IF EXISTS public.meal_items
  ADD COLUMN IF NOT EXISTS original_food_name TEXT,
  ADD COLUMN IF NOT EXISTS matched_fdc_id TEXT,
  ADD COLUMN IF NOT EXISTS matched_food_name TEXT,
  ADD COLUMN IF NOT EXISTS matched_data_type TEXT,
  ADD COLUMN IF NOT EXISTS matched_brand_owner TEXT,
  ADD COLUMN IF NOT EXISTS match_method TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(4,3),
  ADD COLUMN IF NOT EXISTS match_context JSONB,
  ADD COLUMN IF NOT EXISTS match_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meal_items_matched_fdc_id ON public.meal_items(matched_fdc_id);

CREATE TABLE IF NOT EXISTS public.food_match_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_item_id UUID NOT NULL REFERENCES public.meal_items(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  query_text TEXT,
  query_norm TEXT,
  candidates JSONB,
  selected JSONB,
  model JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_match_audits_user ON public.food_match_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_food_match_audits_meal_item ON public.food_match_audits(meal_item_id);

ALTER TABLE public.food_match_audits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_match_audits'
      AND policyname = 'Users can manage own food match audits'
  ) THEN
    CREATE POLICY "Users can manage own food match audits"
      ON public.food_match_audits
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

