/**
 * Reference Data Queries
 * These fetch read-only reference data (no user auth needed)
 */

import { supabase } from '../client';
import { getDemoUserId } from '../constants';

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
  other_ingredients: string[] | null;
  allergens: string[] | null;
  certifications: string[] | null;
  image_url: string | null;
  product_url: string | null;
  barcode: string | null;
  attributes: Record<string, unknown>;
  is_verified: boolean;
  created_by: string;
  created_by_user: string | null;
  created_at: string;
  updated_at: string;
  supplement_ingredients: SupplementIngredient[];
}

/**
 * Public supplements list (verified/system).
 * Safe for SEO/public pages.
 */
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

/**
 * User-facing supplements list (verified + user-created).
 * Enables a truly customizable research/tracking experience.
 */
export async function getSupplementsForUser(): Promise<DatabaseSupplement[]> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('supplements')
    .select(`
      *,
      supplement_ingredients (*)
    `)
    .or(`is_verified.eq.true,created_by_user.eq.${userId}`)
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

export async function searchSupplementsForUser(query: string) {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('supplements')
    .select(`
      *,
      supplement_ingredients (*)
    `)
    .or(
      [
        `name.ilike.%${query}%`,
        `brand.ilike.%${query}%`,
      ].join(',')
    )
    .or(`is_verified.eq.true,created_by_user.eq.${userId}`)
    .order('name')
    .limit(50);

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
