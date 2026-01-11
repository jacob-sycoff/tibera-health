-- Tibera Health Seed Data
-- Run this after 001_initial_schema.sql

-- ============================================
-- 1. HEALTH CONDITIONS
-- ============================================

INSERT INTO public.health_conditions (code, name, description, goal_adjustments) VALUES
  ('pregnancy_first_trimester', 'Pregnancy (1st Trimester)', 'First 12 weeks of pregnancy', '{"folate": 600, "iron": 27, "calories": 0}'),
  ('pregnancy_second_trimester', 'Pregnancy (2nd Trimester)', 'Weeks 13-26 of pregnancy', '{"folate": 600, "iron": 27, "calories": 340}'),
  ('pregnancy_third_trimester', 'Pregnancy (3rd Trimester)', 'Weeks 27-40 of pregnancy', '{"folate": 600, "iron": 27, "calories": 450}'),
  ('breastfeeding', 'Breastfeeding', 'Currently breastfeeding', '{"calories": 500, "protein": 25}'),
  ('athletic_training', 'Athletic Training', 'High-intensity exercise regimen', '{"protein": 50, "calories": 500}'),
  ('weight_loss', 'Weight Loss', 'Caloric deficit for weight loss', '{"calories": -500}'),
  ('weight_gain', 'Weight Gain', 'Caloric surplus for weight gain', '{"calories": 500}'),
  ('heart_health', 'Heart Health', 'Focus on cardiovascular health', '{"sodium_max": 1500}'),
  ('diabetes_management', 'Diabetes Management', 'Blood sugar management', '{"carbs": -50}'),
  ('iron_deficiency', 'Iron Deficiency', 'Low iron levels', '{"iron": 18}'),
  ('bone_health', 'Bone Health', 'Focus on bone density', '{"calcium": 1200, "vitamin_d": 800}'),
  ('vegetarian', 'Vegetarian', 'No meat diet', '{"b12": 6, "iron": 18}'),
  ('vegan', 'Vegan', 'No animal products', '{"b12": 6, "iron": 18, "calcium": 1000}'),
  ('none', 'None', 'No specific health conditions', '{}');


-- ============================================
-- 2. NUTRIENTS (USDA IDs where applicable)
-- ============================================

INSERT INTO public.nutrients (usda_id, name, unit, category, daily_value, is_harmful) VALUES
  -- Macros
  (1008, 'Calories', 'kcal', 'macro', 2000, false),
  (1003, 'Protein', 'g', 'macro', 50, false),
  (1005, 'Carbohydrates', 'g', 'macro', 275, false),
  (1004, 'Total Fat', 'g', 'macro', 78, false),
  (1079, 'Fiber', 'g', 'macro', 28, false),
  (1063, 'Sugars', 'g', 'macro', 50, false),
  (1235, 'Added Sugars', 'g', 'harmful', 50, true),
  (1257, 'Trans Fat', 'g', 'harmful', 0, true),
  (1258, 'Saturated Fat', 'g', 'macro', 20, false),

  -- Vitamins
  (1106, 'Vitamin A', 'mcg', 'vitamin', 900, false),
  (1162, 'Vitamin C', 'mg', 'vitamin', 90, false),
  (1114, 'Vitamin D', 'mcg', 'vitamin', 20, false),
  (1109, 'Vitamin E', 'mg', 'vitamin', 15, false),
  (1185, 'Vitamin K', 'mcg', 'vitamin', 120, false),
  (1165, 'Thiamin (B1)', 'mg', 'vitamin', 1.2, false),
  (1166, 'Riboflavin (B2)', 'mg', 'vitamin', 1.3, false),
  (1167, 'Niacin (B3)', 'mg', 'vitamin', 16, false),
  (1170, 'Pantothenic Acid (B5)', 'mg', 'vitamin', 5, false),
  (1175, 'Vitamin B6', 'mg', 'vitamin', 1.7, false),
  (1176, 'Biotin (B7)', 'mcg', 'vitamin', 30, false),
  (1177, 'Folate', 'mcg', 'vitamin', 400, false),
  (1178, 'Vitamin B12', 'mcg', 'vitamin', 2.4, false),
  (1180, 'Choline', 'mg', 'vitamin', 550, false),

  -- Minerals
  (1087, 'Calcium', 'mg', 'mineral', 1300, false),
  (1089, 'Iron', 'mg', 'mineral', 18, false),
  (1090, 'Magnesium', 'mg', 'mineral', 420, false),
  (1091, 'Phosphorus', 'mg', 'mineral', 1250, false),
  (1092, 'Potassium', 'mg', 'mineral', 4700, false),
  (1093, 'Sodium', 'mg', 'mineral', 2300, false),
  (1095, 'Zinc', 'mg', 'mineral', 11, false),
  (1098, 'Copper', 'mg', 'mineral', 0.9, false),
  (1101, 'Manganese', 'mg', 'mineral', 2.3, false),
  (1103, 'Selenium', 'mcg', 'mineral', 55, false),
  (1099, 'Fluoride', 'mg', 'mineral', 4, false),
  (1100, 'Molybdenum', 'mcg', 'mineral', 45, false),
  (1146, 'Chromium', 'mcg', 'mineral', 35, false),
  (1102, 'Iodine', 'mcg', 'mineral', 150, false),

  -- Other beneficial
  (1253, 'Cholesterol', 'mg', 'other', 300, false),
  (1057, 'Caffeine', 'mg', 'other', 400, false),
  (1018, 'Alcohol', 'g', 'other', NULL, false),
  (NULL, 'Omega-3 (EPA)', 'mg', 'other', 250, false),
  (NULL, 'Omega-3 (DHA)', 'mg', 'other', 250, false),
  (NULL, 'Omega-3 (ALA)', 'mg', 'other', 1600, false),

  -- Potentially harmful (for tracking)
  (NULL, 'Lead', 'mcg', 'harmful', 0, true),
  (NULL, 'Mercury', 'mcg', 'harmful', 0, true),
  (NULL, 'Cadmium', 'mcg', 'harmful', 0, true),
  (NULL, 'Arsenic', 'mcg', 'harmful', 0, true);


-- ============================================
-- 3. SYMPTOMS
-- ============================================

INSERT INTO public.symptoms (name, category, is_system) VALUES
  -- Digestive
  ('Bloating', 'digestive', true),
  ('Gas', 'digestive', true),
  ('Nausea', 'digestive', true),
  ('Stomach Pain', 'digestive', true),
  ('Acid Reflux', 'digestive', true),
  ('Diarrhea', 'digestive', true),
  ('Constipation', 'digestive', true),
  ('Cramps', 'digestive', true),
  ('Loss of Appetite', 'digestive', true),
  ('Heartburn', 'digestive', true),

  -- Energy
  ('Fatigue', 'energy', true),
  ('Low Energy', 'energy', true),
  ('Afternoon Slump', 'energy', true),
  ('Insomnia', 'energy', true),
  ('Restless Sleep', 'energy', true),
  ('Difficulty Waking', 'energy', true),
  ('Brain Fog', 'energy', true),
  ('Drowsiness', 'energy', true),

  -- Mood
  ('Anxiety', 'mood', true),
  ('Irritability', 'mood', true),
  ('Depression', 'mood', true),
  ('Mood Swings', 'mood', true),
  ('Stress', 'mood', true),
  ('Poor Concentration', 'mood', true),
  ('Memory Issues', 'mood', true),

  -- Pain
  ('Headache', 'pain', true),
  ('Migraine', 'pain', true),
  ('Joint Pain', 'pain', true),
  ('Muscle Aches', 'pain', true),
  ('Back Pain', 'pain', true),
  ('Neck Pain', 'pain', true),
  ('Menstrual Cramps', 'pain', true),

  -- Skin
  ('Acne', 'skin', true),
  ('Dry Skin', 'skin', true),
  ('Rash', 'skin', true),
  ('Itching', 'skin', true),
  ('Hives', 'skin', true),
  ('Eczema Flare', 'skin', true),

  -- Respiratory
  ('Congestion', 'respiratory', true),
  ('Sneezing', 'respiratory', true),
  ('Coughing', 'respiratory', true),
  ('Shortness of Breath', 'respiratory', true),
  ('Sore Throat', 'respiratory', true),
  ('Runny Nose', 'respiratory', true),

  -- Other
  ('Dizziness', 'other', true),
  ('Heart Palpitations', 'other', true),
  ('Hot Flashes', 'other', true),
  ('Night Sweats', 'other', true),
  ('Frequent Urination', 'other', true),
  ('Thirst', 'other', true),
  ('Weight Changes', 'other', true),
  ('Swelling', 'other', true);


-- ============================================
-- 4. SYSTEM SUPPLEMENTS (Pre-populated database)
-- ============================================

-- Garden of Life Vitamin Code Women
INSERT INTO public.supplements (name, brand, type, serving_size, servings_per_container, certifications, is_verified, created_by) VALUES
  ('Vitamin Code Women', 'Garden of Life', 'multivitamin', '4 capsules', 30, ARRAY['USDA Organic', 'Non-GMO Verified', 'Gluten Free'], true, 'system');

INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin A', 2500, 'IU', 50, 'beta_carotene', 'whole_food', 1 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin C', 60, 'mg', 100, 'ascorbic_acid', 'whole_food', 2 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin D3', 800, 'IU', 200, 'd3_cholecalciferol', 'plant', 3 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin E', 22, 'IU', 73, 'mixed_tocopherols', 'whole_food', 4 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin K', 80, 'mcg', 100, 'k1_phylloquinone', 'plant', 5 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Folate', 400, 'mcg', 100, 'methylfolate', 'whole_food', 6 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin B12', 100, 'mcg', 1667, 'methylcobalamin', 'bacterial', 7 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Iron', 8, 'mg', 44, 'ferrous_bisglycinate', 'mineral', 8 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Zinc', 4, 'mg', 27, 'glycinate', 'mineral', 9 FROM public.supplements WHERE name = 'Vitamin Code Women' AND brand = 'Garden of Life';

-- Thorne Basic Nutrients 2/Day
INSERT INTO public.supplements (name, brand, type, serving_size, servings_per_container, certifications, is_verified, created_by) VALUES
  ('Basic Nutrients 2/Day', 'Thorne', 'multivitamin', '2 capsules', 30, ARRAY['NSF Certified for Sport', 'Gluten Free'], true, 'system');

INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin A', 2250, 'mcg', 250, 'beta_carotene', 'natural', 1 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin C', 180, 'mg', 200, 'ascorbic_acid', 'synthetic', 2 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin D3', 50, 'mcg', 250, 'd3_cholecalciferol', 'natural', 3 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin E', 67, 'mg', 447, 'mixed_tocopherols', 'natural', 4 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Folate', 680, 'mcg DFE', 170, 'methylfolate', 'synthetic', 5 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin B12', 500, 'mcg', 20833, 'methylcobalamin', 'synthetic', 6 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin B6', 10, 'mg', 588, 'pyridoxal_5_phosphate', 'synthetic', 7 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Magnesium', 100, 'mg', 24, 'citrate', 'mineral', 8 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Zinc', 15, 'mg', 136, 'picolinate', 'mineral', 9 FROM public.supplements WHERE name = 'Basic Nutrients 2/Day' AND brand = 'Thorne';

-- Nordic Naturals Ultimate Omega
INSERT INTO public.supplements (name, brand, type, serving_size, servings_per_container, certifications, is_verified, created_by) VALUES
  ('Ultimate Omega', 'Nordic Naturals', 'omega', '2 soft gels', 60, ARRAY['Non-GMO Verified', 'Friend of the Sea Certified'], true, 'system');

INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, form, source, sort_order)
SELECT id, 'EPA', 650, 'mg', 'other', 'fish', 1 FROM public.supplements WHERE name = 'Ultimate Omega' AND brand = 'Nordic Naturals';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, form, source, sort_order)
SELECT id, 'DHA', 450, 'mg', 'other', 'fish', 2 FROM public.supplements WHERE name = 'Ultimate Omega' AND brand = 'Nordic Naturals';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, form, source, sort_order)
SELECT id, 'Other Omega-3s', 180, 'mg', 'other', 'fish', 3 FROM public.supplements WHERE name = 'Ultimate Omega' AND brand = 'Nordic Naturals';

-- MegaFood Magnesium
INSERT INTO public.supplements (name, brand, type, serving_size, servings_per_container, certifications, is_verified, created_by) VALUES
  ('Magnesium', 'MegaFood', 'mineral', '2 tablets', 45, ARRAY['Non-GMO Project Verified', 'Certified B Corporation', 'Gluten Free', 'Vegetarian'], true, 'system');

INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, notes, sort_order)
SELECT id, 'Magnesium', 300, 'mg', 71, 'glycinate', 'mineral', 'FoodState Magnesium', 1 FROM public.supplements WHERE name = 'Magnesium' AND brand = 'MegaFood';

-- Ritual Essential for Women 18+
INSERT INTO public.supplements (name, brand, type, serving_size, servings_per_container, certifications, is_verified, created_by) VALUES
  ('Essential for Women 18+', 'Ritual', 'multivitamin', '2 capsules', 30, ARRAY['Vegan', 'Non-GMO', 'Gluten Free', 'Third-Party Tested'], true, 'system');

INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, notes, sort_order)
SELECT id, 'Vitamin D3', 50, 'mcg', 250, 'd3_cholecalciferol', 'plant', 'Lichen-sourced', 1 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin E', 6.7, 'mg', 45, 'd_alpha_tocopherol', 'plant', 2 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin K2', 90, 'mcg', 75, 'k2_mk7', 'fermented', 3 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Folate', 680, 'mcg DFE', 170, 'methylfolate', 'synthetic', 4 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin B12', 8, 'mcg', 333, 'methylcobalamin', 'synthetic', 5 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Iron', 8, 'mg', 44, 'ferrous_bisglycinate', 'mineral', 6 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, form, source, sort_order)
SELECT id, 'Omega-3 DHA', 330, 'mg', 'other', 'algae', 7 FROM public.supplements WHERE name = 'Essential for Women 18+' AND brand = 'Ritual';

-- NATURELO Prenatal
INSERT INTO public.supplements (name, brand, type, serving_size, servings_per_container, certifications, is_verified, created_by) VALUES
  ('Prenatal Whole Food Multivitamin', 'NATURELO', 'multivitamin', '3 capsules', 60, ARRAY['Vegan', 'Non-GMO', 'Gluten Free', 'Soy Free'], true, 'system');

INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin A', 900, 'mcg', 100, 'beta_carotene', 'plant', 1 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin C', 100, 'mg', 111, 'ascorbic_acid', 'plant', 2 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin D3', 25, 'mcg', 125, 'd3_cholecalciferol', 'plant', 3 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin K2', 90, 'mcg', 75, 'k2_mk7', 'fermented', 4 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Folate', 800, 'mcg DFE', 133, 'methylfolate', 'synthetic', 5 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Vitamin B12', 25, 'mcg', 893, 'methylcobalamin', 'bacterial', 6 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Iron', 27, 'mg', 150, 'ferrous_bisglycinate', 'mineral', 7 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Calcium', 200, 'mg', 15, 'citrate', 'algae', 8 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, daily_value_percent, form, source, sort_order)
SELECT id, 'Magnesium', 100, 'mg', 24, 'glycinate', 'mineral', 9 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
INSERT INTO public.supplement_ingredients (supplement_id, nutrient_name, amount, unit, form, source, sort_order)
SELECT id, 'DHA (Omega-3)', 200, 'mg', 'other', 'algae', 10 FROM public.supplements WHERE name = 'Prenatal Whole Food Multivitamin' AND brand = 'NATURELO';
