-- Tibera Health: Auth System Migration
-- ======================================
-- 1. Create auth tables (admin_users, tokens)
-- 2. Add email_verified to profiles
-- 3. Delete demo user + data
-- 4. Drop all demo_ RLS policies
-- 5. Re-enable RLS on all tables
-- 6. Restore FK constraint profiles -> auth.users
-- 7. Ensure auth-based RLS policies on newer tables

-- ============================================
-- 1. AUTH TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only service-role can read/write admin_users (no anon/authenticated access)
-- Service role bypasses RLS, so no policies needed.

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token
  ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON public.email_verification_tokens(user_id);

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
  ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON public.password_reset_tokens(user_id);

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. ADD email_verified TO PROFILES
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 3. DELETE DEMO USER + ALL ASSOCIATED DATA
-- ============================================

DO $$
DECLARE
  demo_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Break any non-cascading references to the demo profile before deleting it.
  -- (Some reference tables store optional creator/user ownership without ON DELETE CASCADE.)

  -- Foods/symptoms: these are optional ownership references; keep rows but detach from demo user.
  UPDATE public.foods SET created_by = NULL WHERE created_by = demo_id;
  UPDATE public.symptoms SET created_by = NULL WHERE created_by = demo_id;

  -- Supplements: demo-owned supplements may be referenced by logs (no ON DELETE SET NULL).
  -- Null out any references, then remove the demo-owned supplements (ingredients + organizer items cascade).
  UPDATE public.supplement_logs
    SET supplement_id = NULL
    WHERE supplement_id IN (
      SELECT id FROM public.supplements WHERE created_by_user = demo_id
    );
  DELETE FROM public.supplements WHERE created_by_user = demo_id;

  -- Delete from tables that reference profiles.id via FK (cascade handles most,
  -- but be explicit for tables that may not cascade)
  DELETE FROM public.pill_organizer_items WHERE user_id = demo_id;
  DELETE FROM public.user_goal_events WHERE user_id = demo_id;
  DELETE FROM public.supplement_logs WHERE user_id = demo_id;
  DELETE FROM public.symptom_correlations WHERE user_id = demo_id;
  DELETE FROM public.symptom_logs WHERE user_id = demo_id;
  DELETE FROM public.sleep_logs WHERE user_id = demo_id;
  DELETE FROM public.shopping_items WHERE list_id IN (SELECT id FROM public.shopping_lists WHERE user_id = demo_id);
  DELETE FROM public.shopping_lists WHERE user_id = demo_id;
  DELETE FROM public.planned_meals WHERE meal_plan_id IN (SELECT id FROM public.meal_plans WHERE user_id = demo_id);
  DELETE FROM public.meal_plans WHERE user_id = demo_id;
  DELETE FROM public.meal_items WHERE meal_log_id IN (SELECT id FROM public.meal_logs WHERE user_id = demo_id);
  DELETE FROM public.meal_logs WHERE user_id = demo_id;
  DELETE FROM public.user_health_conditions WHERE user_id = demo_id;
  DELETE FROM public.user_goals WHERE user_id = demo_id;
  DELETE FROM public.user_preferences WHERE user_id = demo_id;

  -- Check if meal_templates exists before deleting
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_templates') THEN
    EXECUTE 'DELETE FROM public.meal_templates WHERE user_id = $1' USING demo_id;
  END IF;

  DELETE FROM public.profiles WHERE id = demo_id;
END $$;

-- ============================================
-- 4. DROP ALL demo_ RLS POLICIES
-- ============================================

-- From 003_demo_access.sql
DROP POLICY IF EXISTS "demo_profiles_all" ON public.profiles;
DROP POLICY IF EXISTS "demo_user_preferences_all" ON public.user_preferences;
DROP POLICY IF EXISTS "demo_user_goals_all" ON public.user_goals;
DROP POLICY IF EXISTS "demo_user_health_conditions_all" ON public.user_health_conditions;
DROP POLICY IF EXISTS "demo_meal_logs_all" ON public.meal_logs;
DROP POLICY IF EXISTS "demo_meal_items_all" ON public.meal_items;
DROP POLICY IF EXISTS "demo_sleep_logs_all" ON public.sleep_logs;
DROP POLICY IF EXISTS "demo_symptom_logs_all" ON public.symptom_logs;
DROP POLICY IF EXISTS "demo_symptom_correlations_all" ON public.symptom_correlations;
DROP POLICY IF EXISTS "demo_supplement_logs_all" ON public.supplement_logs;
DROP POLICY IF EXISTS "demo_meal_plans_all" ON public.meal_plans;
DROP POLICY IF EXISTS "demo_planned_meals_all" ON public.planned_meals;
DROP POLICY IF EXISTS "demo_shopping_lists_all" ON public.shopping_lists;
DROP POLICY IF EXISTS "demo_shopping_items_all" ON public.shopping_items;

-- From 20260119101500_add_user_goal_events.sql
DROP POLICY IF EXISTS "demo_user_goal_events_all" ON public.user_goal_events;

-- From 004_meal_templates.sql (if it had a demo policy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_templates') THEN
    EXECUTE 'DROP POLICY IF EXISTS "demo_meal_templates_all" ON public.meal_templates';
  END IF;
END $$;

-- ============================================
-- 5. RE-ENABLE RLS ON ALL TABLES
-- ============================================

-- User data tables (disabled in 006_disable_rls_for_dev.sql)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_health_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Reference tables
ALTER TABLE public.nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;

-- Newer tables (re-enable in case they were disabled individually)
ALTER TABLE public.pill_organizer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goal_events ENABLE ROW LEVEL SECURITY;

-- Category reference tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'symptom_categories') THEN
    EXECUTE 'ALTER TABLE public.symptom_categories ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shopping_categories') THEN
    EXECUTE 'ALTER TABLE public.shopping_categories ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'meal_templates') THEN
    EXECUTE 'ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================
-- 6. RESTORE FK CONSTRAINT profiles -> auth.users
-- ============================================

-- 006_disable_rls_for_dev.sql dropped this constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 7. ENSURE AUTH-BASED POLICIES ON NEWER TABLES
-- ============================================

-- pill_organizer_items: policy already created in its migration
-- user_goal_events: policy already created in its migration

-- Tighten reference-table access now that users can create custom rows.
-- Goal:
-- - Public/anon can read only "system/verified" reference data
-- - Authenticated users can also read their own custom rows
-- - Only owners can insert/update/delete custom rows

-- ============================================
-- FOODS
-- ============================================

-- Clean up any earlier/experimental policies if present.
DROP POLICY IF EXISTS "Users can manage custom foods" ON public.foods;

-- Replace the overly-broad "Anyone can read foods" policy so custom foods are private.
DROP POLICY IF EXISTS "Anyone can read foods" ON public.foods;
CREATE POLICY "Anyone can read foods" ON public.foods
  FOR SELECT USING (is_custom = false OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert custom foods" ON public.foods;
CREATE POLICY "Users can insert custom foods" ON public.foods
  FOR INSERT WITH CHECK (is_custom = true AND created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own custom foods" ON public.foods;
CREATE POLICY "Users can update own custom foods" ON public.foods
  FOR UPDATE
  USING (is_custom = true AND created_by = auth.uid())
  WITH CHECK (is_custom = true AND created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own custom foods" ON public.foods;
CREATE POLICY "Users can delete own custom foods" ON public.foods
  FOR DELETE USING (is_custom = true AND created_by = auth.uid());

-- ============================================
-- SYMPTOMS
-- ============================================

-- Clean up any earlier/experimental policies if present.
DROP POLICY IF EXISTS "Users can manage custom symptoms" ON public.symptoms;

-- Replace the overly-broad "Anyone can read symptoms" policy so custom symptoms are private.
DROP POLICY IF EXISTS "Anyone can read symptoms" ON public.symptoms;
CREATE POLICY "Anyone can read symptoms" ON public.symptoms
  FOR SELECT USING (is_system = true OR created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert custom symptoms" ON public.symptoms;
CREATE POLICY "Users can insert custom symptoms" ON public.symptoms
  FOR INSERT WITH CHECK (is_system = false AND created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own custom symptoms" ON public.symptoms;
CREATE POLICY "Users can update own custom symptoms" ON public.symptoms
  FOR UPDATE
  USING (is_system = false AND created_by = auth.uid())
  WITH CHECK (is_system = false AND created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own custom symptoms" ON public.symptoms;
CREATE POLICY "Users can delete own custom symptoms" ON public.symptoms
  FOR DELETE USING (is_system = false AND created_by = auth.uid());

-- ============================================
-- SUPPLEMENTS + INGREDIENTS
-- ============================================

-- Clean up any earlier/experimental policies if present.
DROP POLICY IF EXISTS "Users can manage own supplements" ON public.supplements;
DROP POLICY IF EXISTS "Users can manage supplement ingredients" ON public.supplement_ingredients;

-- Replace the overly-broad "Anyone can read supplements" policy so user-created supplements are private.
DROP POLICY IF EXISTS "Anyone can read supplements" ON public.supplements;
CREATE POLICY "Anyone can read supplements" ON public.supplements
  FOR SELECT USING (is_verified = true OR created_by_user = auth.uid());

DROP POLICY IF EXISTS "Users can insert own supplements" ON public.supplements;
CREATE POLICY "Users can insert own supplements" ON public.supplements
  FOR INSERT
  WITH CHECK (
    created_by = 'user'
    AND created_by_user = auth.uid()
    AND is_verified = false
  );

DROP POLICY IF EXISTS "Users can update own supplements" ON public.supplements;
CREATE POLICY "Users can update own supplements" ON public.supplements
  FOR UPDATE
  USING (created_by_user = auth.uid() AND is_verified = false)
  WITH CHECK (created_by_user = auth.uid() AND is_verified = false);

DROP POLICY IF EXISTS "Users can delete own supplements" ON public.supplements;
CREATE POLICY "Users can delete own supplements" ON public.supplements
  FOR DELETE USING (created_by_user = auth.uid() AND is_verified = false);

-- Restrict ingredient visibility to verified supplements or the owning user.
DROP POLICY IF EXISTS "Anyone can read supplement ingredients" ON public.supplement_ingredients;
CREATE POLICY "Anyone can read supplement ingredients" ON public.supplement_ingredients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.supplements s
      WHERE s.id = supplement_ingredients.supplement_id
        AND (s.is_verified = true OR s.created_by_user = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can manage ingredients for own supplements" ON public.supplement_ingredients;
CREATE POLICY "Users can manage ingredients for own supplements" ON public.supplement_ingredients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.supplements s
      WHERE s.id = supplement_ingredients.supplement_id
        AND s.created_by_user = auth.uid()
        AND s.is_verified = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.supplements s
      WHERE s.id = supplement_ingredients.supplement_id
        AND s.created_by_user = auth.uid()
        AND s.is_verified = false
    )
  );
