/**
 * Reference Data Queries
 * These fetch read-only reference data (no user auth needed)
 */

import { supabase } from '../client';

// ============================================
// NUTRIENTS
// ============================================

export async function getNutrients() {
  const { data, error } = await supabase
    .from('nutrients')
    .select('*')
    .order('category')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getNutrientById(id: string) {
  const { data, error } = await supabase
    .from('nutrients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getNutrientsByCategory(category: string) {
  const { data, error } = await supabase
    .from('nutrients')
    .select('*')
    .eq('category', category)
    .order('name');

  if (error) throw error;
  return data;
}

// ============================================
// SYMPTOMS (Reference)
// ============================================

export async function getSymptoms() {
  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .order('category')
    .order('name');

  if (error) throw error;
  return data;
}

export async function getSymptomsByCategory(category: string) {
  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .eq('category', category)
    .order('name');

  if (error) throw error;
  return data;
}

// ============================================
// HEALTH CONDITIONS (Reference)
// ============================================

export async function getHealthConditions() {
  const { data, error } = await supabase
    .from('health_conditions')
    .select('*')
    .order('name');

  if (error) throw error;
  return data;
}

// ============================================
// SUPPLEMENTS (Reference Database)
// ============================================

export interface SupplementIngredient {
  id: string;
  supplement_id: string;
  nutrient_id: string | null;
  nutrient_name: string;
  amount: number;
  unit: string;
  daily_value_percent: number | null;
  form: string;
  source: string;
  notes: string | null;
  sort_order: number;
}

export interface DatabaseSupplement {
  id: string;
  name: string;
  brand: string | null;
  type: string;
  serving_size: string | null;
  servings_per_container: number | null;
  other_ingredients: string[];
  allergens: string[];
  certifications: string[];
  image_url: string | null;
  product_url: string | null;
  barcode: string | null;
  is_verified: boolean;
  created_by: string;
  created_by_user: string | null;
  created_at: string;
  updated_at: string;
  supplement_ingredients: SupplementIngredient[];
}

export async function getSupplements(): Promise<DatabaseSupplement[]> {
  const { data, error } = await supabase
    .from('supplements')
    .select(`
      *,
      supplement_ingredients (*)
    `)
    .eq('is_verified', true)
    .order('brand')
    .order('name');

  if (error) throw error;
  return (data ?? []) as DatabaseSupplement[];
}

export async function getSupplementById(id: string) {
  const { data, error } = await supabase
    .from('supplements')
    .select(`
      *,
      supplement_ingredients (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function searchSupplements(query: string) {
  const { data, error } = await supabase
    .from('supplements')
    .select(`
      *,
      supplement_ingredients (*)
    `)
    .or(`name.ilike.%${query}%,brand.ilike.%${query}%`)
    .order('name')
    .limit(20);

  if (error) throw error;
  return data;
}

// ============================================
// FOODS (Cached from USDA + Custom)
// ============================================

export async function getFoods(limit = 100) {
  const { data, error } = await supabase
    .from('foods')
    .select(`
      *,
      food_nutrients (
        *,
        nutrient:nutrients (*)
      )
    `)
    .order('name')
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getFoodById(id: string) {
  const { data, error } = await supabase
    .from('foods')
    .select(`
      *,
      food_nutrients (
        *,
        nutrient:nutrients (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function searchFoods(query: string) {
  const { data, error } = await supabase
    .from('foods')
    .select(`
      *,
      food_nutrients (
        *,
        nutrient:nutrients (*)
      )
    `)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);

  if (error) throw error;
  return data;
}
