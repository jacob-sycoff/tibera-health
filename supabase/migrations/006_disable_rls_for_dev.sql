-- Disable RLS for Development
-- ================================
-- This migration disables Row Level Security for local development.
-- When implementing auth, simply re-enable RLS on these tables.
--
-- TO RE-ENABLE FOR PRODUCTION:
-- 1. Run: ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
-- 2. The original policies from 001_initial_schema.sql will take effect
-- 3. Remove the demo_ policies from 003_demo_access.sql
-- 4. Re-add the FK constraint: ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

-- Step 1: Remove the FK constraint on profiles so we can create a demo user without auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Disable RLS on user data tables
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_health_conditions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_correlations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_meals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items DISABLE ROW LEVEL SECURITY;

-- Step 3: Keep RLS disabled on reference tables too (they were read-only anyway)
ALTER TABLE public.nutrients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_nutrients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_ingredients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_conditions DISABLE ROW LEVEL SECURITY;

-- Step 4: Create demo user (FK constraint removed above, so this will work)
INSERT INTO public.profiles (id, display_name, timezone)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Demo User', 'America/New_York')
ON CONFLICT (id) DO UPDATE SET display_name = 'Demo User';

-- Create demo user preferences
INSERT INTO public.user_preferences (user_id, units, theme, notifications_enabled)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'metric', 'system', true)
ON CONFLICT (user_id) DO NOTHING;

-- Create demo user goals
INSERT INTO public.user_goals (user_id, calories, protein, carbs, fat, fiber)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 2000, 50, 275, 78, 28)
ON CONFLICT (user_id) DO NOTHING;
