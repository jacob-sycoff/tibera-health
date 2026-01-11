-- Tibera Health Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ENUMS (Custom Types)
-- ============================================

-- Health Conditions
CREATE TYPE health_condition AS ENUM (
  'pregnancy_first_trimester',
  'pregnancy_second_trimester',
  'pregnancy_third_trimester',
  'breastfeeding',
  'athletic_training',
  'weight_loss',
  'weight_gain',
  'heart_health',
  'diabetes_management',
  'iron_deficiency',
  'bone_health',
  'vegetarian',
  'vegan',
  'none'
);

-- Meal Types
CREATE TYPE meal_type AS ENUM (
  'breakfast',
  'lunch',
  'dinner',
  'snack'
);

-- Sleep Quality (1-5)
CREATE TYPE sleep_quality AS ENUM ('1', '2', '3', '4', '5');

-- Sleep Factors
CREATE TYPE sleep_factor AS ENUM (
  'caffeine',
  'alcohol',
  'exercise',
  'stress',
  'screen_time',
  'late_meal',
  'medication'
);

-- Symptom Categories
CREATE TYPE symptom_category AS ENUM (
  'digestive',
  'energy',
  'mood',
  'pain',
  'skin',
  'respiratory',
  'other'
);

-- Nutrient Categories
CREATE TYPE nutrient_category AS ENUM (
  'macro',
  'vitamin',
  'mineral',
  'other',
  'harmful'
);

-- Supplement Types
CREATE TYPE supplement_type AS ENUM (
  'multivitamin',
  'single',
  'mineral',
  'herbal',
  'amino',
  'probiotic',
  'omega',
  'other'
);

-- Nutrient Forms
CREATE TYPE nutrient_form AS ENUM (
  'd3_cholecalciferol', 'd2_ergocalciferol',
  'methylcobalamin', 'cyanocobalamin',
  'methylfolate', 'folic_acid',
  'ascorbic_acid', 'sodium_ascorbate',
  'citrate', 'oxide', 'glycinate', 'chelated',
  'picolinate', 'sulfate', 'gluconate', 'carbonate',
  'bisglycinate', 'threonate', 'malate', 'taurate', 'orotate',
  'ferrous_sulfate', 'ferrous_gluconate', 'ferrous_bisglycinate', 'heme_iron',
  'retinyl_palmitate', 'beta_carotene',
  'mixed_tocopherols', 'd_alpha_tocopherol', 'dl_alpha_tocopherol',
  'k1_phylloquinone', 'k2_mk4', 'k2_mk7',
  'thiamine_hcl', 'benfotiamine',
  'riboflavin', 'riboflavin_5_phosphate',
  'niacinamide', 'nicotinic_acid',
  'pyridoxine_hcl', 'pyridoxal_5_phosphate',
  'other', 'unknown'
);

-- Nutrient Sources
CREATE TYPE nutrient_source AS ENUM (
  'synthetic', 'natural', 'fermented', 'whole_food',
  'algae', 'fish', 'plant', 'animal',
  'mineral', 'yeast', 'bacterial', 'unknown'
);

-- Shopping Categories
CREATE TYPE shopping_category AS ENUM (
  'produce', 'dairy', 'meat', 'grains',
  'frozen', 'canned', 'snacks', 'beverages',
  'household', 'other'
);

-- Supplement Creator Type
CREATE TYPE creator_type AS ENUM ('system', 'user', 'ai');


-- ============================================
-- 2. CORE USER TABLES
-- ============================================

-- Users (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Preferences
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  units TEXT DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- User Nutrient Goals
CREATE TABLE public.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  calories INTEGER DEFAULT 2000,
  protein INTEGER DEFAULT 50,
  carbs INTEGER DEFAULT 250,
  fat INTEGER DEFAULT 65,
  fiber INTEGER DEFAULT 25,
  custom_nutrients JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Health Conditions (Reference Table)
CREATE TABLE public.health_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code health_condition UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goal_adjustments JSONB DEFAULT '{}'
);

-- User Health Conditions (Junction Table)
CREATE TABLE public.user_health_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  condition_code health_condition NOT NULL,
  started_at DATE DEFAULT CURRENT_DATE,
  ended_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, condition_code)
);


-- ============================================
-- 3. FOOD & NUTRITION TABLES
-- ============================================

-- Nutrients (Reference Table)
CREATE TABLE public.nutrients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usda_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  category nutrient_category NOT NULL,
  daily_value DECIMAL(10,2),
  description TEXT,
  is_harmful BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Foods (Cached from USDA + Custom)
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fdc_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  serving_size DECIMAL(10,2),
  serving_unit TEXT,
  category TEXT,
  ingredients TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Food Nutrients (Junction Table)
CREATE TABLE public.food_nutrients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  nutrient_id UUID NOT NULL REFERENCES public.nutrients(id) ON DELETE CASCADE,
  amount_per_serving DECIMAL(10,4),
  amount_per_100g DECIMAL(10,4),
  UNIQUE(food_id, nutrient_id)
);

-- Meal Logs
CREATE TABLE public.meal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type meal_type NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal Items
CREATE TABLE public.meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_log_id UUID NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
  food_id UUID REFERENCES public.foods(id),
  custom_food_name TEXT,
  custom_food_nutrients JSONB,
  servings DECIMAL(6,2) DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for meal queries
CREATE INDEX idx_meal_logs_user_date ON public.meal_logs(user_id, date);
CREATE INDEX idx_meal_logs_date ON public.meal_logs(date);


-- ============================================
-- 4. SLEEP TRACKING TABLES
-- ============================================

-- Sleep Logs
CREATE TABLE public.sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  bedtime TIME NOT NULL,
  wake_time TIME NOT NULL,
  duration_minutes INTEGER,
  quality sleep_quality NOT NULL,
  factors sleep_factor[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Indexes for sleep queries
CREATE INDEX idx_sleep_logs_user_date ON public.sleep_logs(user_id, date);


-- ============================================
-- 5. SYMPTOM TRACKING TABLES
-- ============================================

-- Symptoms (Reference + Custom)
CREATE TABLE public.symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category symptom_category NOT NULL,
  is_system BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Symptom Logs
CREATE TABLE public.symptom_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symptom_id UUID NOT NULL REFERENCES public.symptoms(id),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Symptom Correlations (Computed/Cached)
CREATE TABLE public.symptom_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symptom_id UUID NOT NULL REFERENCES public.symptoms(id),
  correlated_type TEXT NOT NULL CHECK (correlated_type IN ('food', 'sleep', 'supplement')),
  correlated_id UUID,
  correlated_name TEXT,
  correlation_score DECIMAL(5,4) CHECK (correlation_score BETWEEN -1 AND 1),
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for symptom queries
CREATE INDEX idx_symptom_logs_user ON public.symptom_logs(user_id);
CREATE INDEX idx_symptom_logs_date ON public.symptom_logs(logged_at);
CREATE INDEX idx_symptom_logs_symptom ON public.symptom_logs(symptom_id);


-- ============================================
-- 6. SUPPLEMENT TABLES
-- ============================================

-- Supplements (Database of all supplements)
CREATE TABLE public.supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT,
  type supplement_type NOT NULL DEFAULT 'other',
  serving_size TEXT,
  servings_per_container INTEGER,
  other_ingredients TEXT[],
  allergens TEXT[],
  certifications TEXT[],
  image_url TEXT,
  product_url TEXT,
  barcode TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_by creator_type DEFAULT 'user',
  created_by_user UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplement Ingredients
CREATE TABLE public.supplement_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  nutrient_id UUID REFERENCES public.nutrients(id),
  nutrient_name TEXT NOT NULL,
  amount DECIMAL(10,4) NOT NULL,
  unit TEXT NOT NULL,
  daily_value_percent DECIMAL(8,2),
  form nutrient_form DEFAULT 'unknown',
  source nutrient_source DEFAULT 'unknown',
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Supplement Logs (User intake tracking)
CREATE TABLE public.supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplement_id UUID REFERENCES public.supplements(id),
  supplement_name TEXT NOT NULL,
  dosage DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplement queries
CREATE INDEX idx_supplement_logs_user ON public.supplement_logs(user_id);
CREATE INDEX idx_supplement_logs_date ON public.supplement_logs(logged_at);
CREATE INDEX idx_supplements_brand ON public.supplements(brand);
CREATE INDEX idx_supplements_type ON public.supplements(type);


-- ============================================
-- 7. MEAL PLANNING & SHOPPING TABLES
-- ============================================

-- Meal Plans
CREATE TABLE public.meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planned Meals
CREATE TABLE public.planned_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type meal_type NOT NULL,
  food_id UUID REFERENCES public.foods(id),
  custom_food_name TEXT,
  servings DECIMAL(6,2) DEFAULT 1,
  notes TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Shopping Lists
CREATE TABLE public.shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopping Items
CREATE TABLE public.shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  category shopping_category DEFAULT 'other',
  is_checked BOOLEAN DEFAULT false,
  from_meal_plan BOOLEAN DEFAULT false,
  meal_plan_id UUID REFERENCES public.meal_plans(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for planning queries
CREATE INDEX idx_meal_plans_user ON public.meal_plans(user_id);
CREATE INDEX idx_shopping_lists_user ON public.shopping_lists(user_id);
CREATE INDEX idx_shopping_items_list ON public.shopping_items(list_id);


-- ============================================
-- 8. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all user tables
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

-- Enable RLS on reference tables (for insert/update restrictions)
ALTER TABLE public.nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User preferences policies
CREATE POLICY "Users can manage own preferences" ON public.user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- User goals policies
CREATE POLICY "Users can manage own goals" ON public.user_goals
  FOR ALL USING (auth.uid() = user_id);

-- User conditions policies
CREATE POLICY "Users can manage own conditions" ON public.user_health_conditions
  FOR ALL USING (auth.uid() = user_id);

-- Meal logs policies
CREATE POLICY "Users can manage own meal logs" ON public.meal_logs
  FOR ALL USING (auth.uid() = user_id);

-- Meal items policies (through meal_logs)
CREATE POLICY "Users can manage own meal items" ON public.meal_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meal_logs
      WHERE meal_logs.id = meal_items.meal_log_id
      AND meal_logs.user_id = auth.uid()
    )
  );

-- Sleep logs policies
CREATE POLICY "Users can manage own sleep logs" ON public.sleep_logs
  FOR ALL USING (auth.uid() = user_id);

-- Symptom logs policies
CREATE POLICY "Users can manage own symptom logs" ON public.symptom_logs
  FOR ALL USING (auth.uid() = user_id);

-- Symptom correlations policies
CREATE POLICY "Users can view own correlations" ON public.symptom_correlations
  FOR ALL USING (auth.uid() = user_id);

-- Supplement logs policies
CREATE POLICY "Users can manage own supplement logs" ON public.supplement_logs
  FOR ALL USING (auth.uid() = user_id);

-- Meal plans policies
CREATE POLICY "Users can manage own meal plans" ON public.meal_plans
  FOR ALL USING (auth.uid() = user_id);

-- Planned meals policies (through meal_plans)
CREATE POLICY "Users can manage own planned meals" ON public.planned_meals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meal_plans
      WHERE meal_plans.id = planned_meals.meal_plan_id
      AND meal_plans.user_id = auth.uid()
    )
  );

-- Shopping lists policies
CREATE POLICY "Users can manage own shopping lists" ON public.shopping_lists
  FOR ALL USING (auth.uid() = user_id);

-- Shopping items policies (through shopping_lists)
CREATE POLICY "Users can manage own shopping items" ON public.shopping_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists
      WHERE shopping_lists.id = shopping_items.list_id
      AND shopping_lists.user_id = auth.uid()
    )
  );

-- Public read access for reference tables
CREATE POLICY "Anyone can read nutrients" ON public.nutrients
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read foods" ON public.foods
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read food nutrients" ON public.food_nutrients
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read symptoms" ON public.symptoms
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read supplements" ON public.supplements
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read supplement ingredients" ON public.supplement_ingredients
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read health conditions" ON public.health_conditions
  FOR SELECT USING (true);


-- ============================================
-- 9. TRIGGERS FOR UPDATED TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_foods_updated_at
  BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_logs_updated_at
  BEFORE UPDATE ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sleep_logs_updated_at
  BEFORE UPDATE ON public.sleep_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_symptom_logs_updated_at
  BEFORE UPDATE ON public.symptom_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplements_updated_at
  BEFORE UPDATE ON public.supplements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 10. HELPER FUNCTION FOR NEW USER SETUP
-- ============================================

-- Function to create profile and defaults when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  -- Create default preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);

  -- Create default goals
  INSERT INTO public.user_goals (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
