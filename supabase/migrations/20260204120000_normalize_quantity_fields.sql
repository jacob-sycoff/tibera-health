-- Adds normalized quantity fields for more accurate logging from natural language.
-- Idempotent: safe to run multiple times.

ALTER TABLE IF EXISTS public.meal_items
  ADD COLUMN IF NOT EXISTS grams_consumed DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS quantity_count DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS quantity_unit TEXT;

ALTER TABLE IF EXISTS public.supplement_logs
  ADD COLUMN IF NOT EXISTS dose_count DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS dose_unit TEXT,
  ADD COLUMN IF NOT EXISTS strength_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS strength_unit TEXT;

