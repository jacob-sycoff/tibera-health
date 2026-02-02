/**
 * Meal Queries
 * Meal logs and meal items
 */

import { supabase } from '../client';
import { getDemoUserId } from '../constants';

// ============================================
// TYPES
// ============================================

export interface MealItem {
  id: string;
  meal_log_id: string;
  food_id: string | null;
  custom_food_name: string | null;
  custom_food_nutrients: Record<string, number> | null;
  servings: number;
  created_at: string;
  food?: {
    id: string;
    name: string;
    [key: string]: unknown;
  } | null;
}

export interface MealLog {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes: string | null;
  created_at: string;
  updated_at: string;
  meal_items: MealItem[];
}

// ============================================
// MEAL LOGS
// ============================================

export async function getMealLogs(startDate?: string, endDate?: string): Promise<MealLog[]> {
  const userId = getDemoUserId();

  let query = supabase
    .from('meal_logs')
    .select(`
      *,
      meal_items (
        *,
        food:foods (
          *,
          food_nutrients (
            *,
            nutrient:nutrients (*)
          )
        )
      )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as MealLog[];
}

export async function getMealLogsByDate(date: string): Promise<MealLog[]> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('meal_logs')
    .select(`
      *,
      meal_items (
        *,
        food:foods (
          *,
          food_nutrients (
            *,
            nutrient:nutrients (*)
          )
        )
      )
    `)
    .eq('user_id', userId)
    .eq('date', date)
    .order('meal_type');

  if (error) throw error;
  return (data ?? []) as MealLog[];
}

export async function getMealLogById(id: string): Promise<MealLog | null> {
  const { data, error } = await supabase
    .from('meal_logs')
    .select(`
      *,
      meal_items (
        *,
        food:foods (
          *,
          food_nutrients (
            *,
            nutrient:nutrients (*)
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as MealLog | null;
}

export async function createMealLog(meal: {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string;
  items: Array<{
    food_id?: string;
    custom_food_name?: string;
    custom_food_nutrients?: Record<string, number>;
    servings: number;
  }>;
}) {
  const userId = getDemoUserId();

  // Create meal log
  const { data: mealLog, error: mealError } = await supabase
    .from('meal_logs')
    .insert({
      user_id: userId,
      date: meal.date,
      meal_type: meal.meal_type,
      notes: meal.notes,
    })
    .select()
    .single();

  if (mealError) throw mealError;

  // Create meal items
  if (meal.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('meal_items')
      .insert(
        meal.items.map(item => ({
          meal_log_id: mealLog.id,
          food_id: item.food_id,
          custom_food_name: item.custom_food_name,
          custom_food_nutrients: item.custom_food_nutrients,
          servings: item.servings,
        }))
      );

    if (itemsError) throw itemsError;
  }

  return getMealLogById(mealLog.id);
}

export interface MealLogBasic {
  id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function updateMealLog(
  id: string,
  updates: {
    date?: string;
    meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    notes?: string;
  }
): Promise<MealLogBasic> {
  const { data, error } = await supabase
    .from('meal_logs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MealLogBasic;
}

export async function deleteMealLog(id: string) {
  // Meal items will be cascade deleted
  const { error } = await supabase
    .from('meal_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// MEAL ITEMS
// ============================================

export async function addMealItem(
  mealLogId: string,
  item: {
    food_id?: string;
    custom_food_name?: string;
    custom_food_nutrients?: Record<string, number>;
    servings: number;
  }
) {
  const { data, error } = await supabase
    .from('meal_items')
    .insert({
      meal_log_id: mealLogId,
      ...item,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMealItem(
  id: string,
  updates: {
    servings?: number;
    custom_food_name?: string | null;
    custom_food_nutrients?: Record<string, number> | null;
  }
) {
  const { data, error } = await supabase
    .from('meal_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMealItem(id: string) {
  const { error } = await supabase
    .from('meal_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
