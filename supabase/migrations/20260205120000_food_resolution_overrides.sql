-- User-specific USDA resolution overrides.
-- Stores a preferred USDA FDC id for a normalized query string.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.food_resolution_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query_norm TEXT NOT NULL,
  fdc_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, query_norm)
);

ALTER TABLE public.food_resolution_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_resolution_overrides'
      AND policyname = 'Users can manage own food resolution overrides'
  ) THEN
    CREATE POLICY "Users can manage own food resolution overrides"
      ON public.food_resolution_overrides
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

