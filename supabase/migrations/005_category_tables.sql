-- Category Reference Tables Migration
-- Creates reference tables for symptom and shopping categories

-- ============================================
-- SYMPTOM CATEGORIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.symptom_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- matches symptom_category ENUM value
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.symptom_categories ENABLE ROW LEVEL SECURITY;

-- Public read access (reference data)
CREATE POLICY "Symptom categories are viewable by everyone"
  ON public.symptom_categories FOR SELECT
  USING (true);

-- Seed symptom categories
INSERT INTO public.symptom_categories (slug, label, sort_order) VALUES
  ('digestive', 'Digestive', 1),
  ('energy', 'Energy', 2),
  ('mood', 'Mood', 3),
  ('pain', 'Pain', 4),
  ('skin', 'Skin', 5),
  ('respiratory', 'Respiratory', 6),
  ('other', 'Other', 7)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- SHOPPING CATEGORIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.shopping_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- matches shopping_category ENUM value
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.shopping_categories ENABLE ROW LEVEL SECURITY;

-- Public read access (reference data)
CREATE POLICY "Shopping categories are viewable by everyone"
  ON public.shopping_categories FOR SELECT
  USING (true);

-- Seed shopping categories
INSERT INTO public.shopping_categories (slug, label, sort_order) VALUES
  ('produce', 'Produce', 1),
  ('dairy', 'Dairy', 2),
  ('meat', 'Meat & Seafood', 3),
  ('grains', 'Grains & Bakery', 4),
  ('frozen', 'Frozen', 5),
  ('canned', 'Canned & Packaged', 6),
  ('snacks', 'Snacks', 7),
  ('beverages', 'Beverages', 8),
  ('household', 'Household', 9),
  ('other', 'Other', 10)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_symptom_categories_sort ON public.symptom_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_shopping_categories_sort ON public.shopping_categories(sort_order);
