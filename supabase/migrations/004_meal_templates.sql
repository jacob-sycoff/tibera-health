-- ============================================
-- MEAL TEMPLATES
-- Save frequently used meals for quick planning
-- ============================================

-- Meal Templates table
CREATE TABLE IF NOT EXISTS public.meal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  meal_type meal_type, -- Optional: suggest which meal type this is for
  items JSONB NOT NULL DEFAULT '[]', -- [{food_name, servings, calories, protein?, carbs?, fat?}]
  total_calories INTEGER DEFAULT 0,
  total_protein DECIMAL(6,2),
  total_carbs DECIMAL(6,2),
  total_fat DECIMAL(6,2),
  use_count INTEGER DEFAULT 0, -- Track popularity for sorting
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_templates_user ON public.meal_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_templates_use_count ON public.meal_templates(user_id, use_count DESC);

-- RLS Policies
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own templates
CREATE POLICY "Users can view own meal templates"
  ON public.meal_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own meal templates"
  ON public.meal_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal templates"
  ON public.meal_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal templates"
  ON public.meal_templates FOR DELETE
  USING (auth.uid() = user_id);

-- Demo user access (for development without auth)
CREATE POLICY "demo_meal_templates_select"
  ON public.meal_templates FOR SELECT
  USING (user_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "demo_meal_templates_insert"
  ON public.meal_templates FOR INSERT
  WITH CHECK (user_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "demo_meal_templates_update"
  ON public.meal_templates FOR UPDATE
  USING (user_id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "demo_meal_templates_delete"
  ON public.meal_templates FOR DELETE
  USING (user_id = '00000000-0000-0000-0000-000000000001');
