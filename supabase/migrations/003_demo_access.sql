-- Tibera Health - Demo Access Migration
-- This migration adds permissive policies for development/demo mode
-- These policies should be REMOVED when implementing real authentication
--
-- TODO FOR AUTH IMPLEMENTATION:
-- 1. Remove all policies with "demo_" prefix
-- 2. The original RLS policies (using auth.uid()) will then take effect
-- 3. Implement Supabase Auth (email/password, OAuth, etc.)
-- 4. Update the client to use auth session

-- ============================================
-- DEMO ACCESS POLICIES
-- These allow all operations without authentication
-- ============================================

-- Profiles
CREATE POLICY "demo_profiles_all" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);

-- User Preferences
CREATE POLICY "demo_user_preferences_all" ON public.user_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- User Goals
CREATE POLICY "demo_user_goals_all" ON public.user_goals
  FOR ALL USING (true) WITH CHECK (true);

-- User Health Conditions
CREATE POLICY "demo_user_health_conditions_all" ON public.user_health_conditions
  FOR ALL USING (true) WITH CHECK (true);

-- Meal Logs
CREATE POLICY "demo_meal_logs_all" ON public.meal_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Meal Items
CREATE POLICY "demo_meal_items_all" ON public.meal_items
  FOR ALL USING (true) WITH CHECK (true);

-- Sleep Logs
CREATE POLICY "demo_sleep_logs_all" ON public.sleep_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Symptom Logs
CREATE POLICY "demo_symptom_logs_all" ON public.symptom_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Symptom Correlations
CREATE POLICY "demo_symptom_correlations_all" ON public.symptom_correlations
  FOR ALL USING (true) WITH CHECK (true);

-- Supplement Logs
CREATE POLICY "demo_supplement_logs_all" ON public.supplement_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Meal Plans
CREATE POLICY "demo_meal_plans_all" ON public.meal_plans
  FOR ALL USING (true) WITH CHECK (true);

-- Planned Meals
CREATE POLICY "demo_planned_meals_all" ON public.planned_meals
  FOR ALL USING (true) WITH CHECK (true);

-- Shopping Lists
CREATE POLICY "demo_shopping_lists_all" ON public.shopping_lists
  FOR ALL USING (true) WITH CHECK (true);

-- Shopping Items
CREATE POLICY "demo_shopping_items_all" ON public.shopping_items
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- DEMO USER SETUP
-- Create a demo user profile for development
-- ============================================

-- Demo user ID (fixed UUID for consistency)
-- This ID will be used by the app when no auth is present
DO $$
BEGIN
  -- Insert demo profile if it doesn't exist
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Demo User',
    'America/New_York'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert demo preferences
  INSERT INTO public.user_preferences (user_id, units, theme, notifications_enabled)
  VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'metric',
    'system',
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert demo goals
  INSERT INTO public.user_goals (user_id, calories, protein, carbs, fat, fiber)
  VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    2000,
    50,
    275,
    78,
    28
  )
  ON CONFLICT (user_id) DO NOTHING;
END $$;

-- ============================================
-- DOCUMENTATION FOR AUTH IMPLEMENTATION
-- ============================================
COMMENT ON POLICY "demo_profiles_all" ON public.profiles IS
  'DEMO ONLY: Remove this policy when implementing authentication';
COMMENT ON POLICY "demo_user_preferences_all" ON public.user_preferences IS
  'DEMO ONLY: Remove this policy when implementing authentication';
COMMENT ON POLICY "demo_user_goals_all" ON public.user_goals IS
  'DEMO ONLY: Remove this policy when implementing authentication';
