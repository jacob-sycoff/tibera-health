/**
 * Meal Planning Queries
 * Meal plans and planned meals for future meal planning
 */

import { supabase } from '../client';
import { getDemoUserId } from '../constants';

// ============================================
// TYPES
// ============================================

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlannedMeal {
  id: string;
  meal_plan_id: string;
  date: string;
  meal_type: MealType;
  food_id: string | null;
  custom_food_name: string | null;
  servings: number;
  notes: string | null;
  sort_order: number;
  food?: {
    id: string;
    name: string;
    calories_per_serving: number;
    serving_size: string;
    serving_unit: string;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
}

export interface MealPlan {
  id: string;
  user_id: string;
  name: string | null;
  week_start: string;
  created_at: string;
  updated_at: string;
  planned_meals?: PlannedMeal[];
}

// ============================================
// MEAL PLANS
// ============================================

export async function getMealPlans(): Promise<MealPlan[]> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MealPlan[];
}

export async function getMealPlanByWeek(weekStart: string): Promise<MealPlan | null> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('meal_plans')
    .select(`
      *,
      planned_meals (
        *,
        food:foods (
          id,
          name,
          calories_per_serving,
          serving_size,
          serving_unit,
          protein_g,
          carbs_g,
          fat_g
        )
      )
    `)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as MealPlan | null;
}

export async function createMealPlan(weekStart: string, name?: string): Promise<MealPlan> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('meal_plans')
    .insert({
      user_id: userId,
      week_start: weekStart,
      name: name || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MealPlan;
}

export async function getOrCreateMealPlan(weekStart: string): Promise<MealPlan> {
  const existing = await getMealPlanByWeek(weekStart);
  if (existing) return existing;
  return createMealPlan(weekStart);
}

export async function updateMealPlan(
  id: string,
  updates: { name?: string }
): Promise<MealPlan> {
  const { data, error } = await supabase
    .from('meal_plans')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MealPlan;
}

export async function deleteMealPlan(id: string): Promise<void> {
  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// PLANNED MEALS
// ============================================

export async function getPlannedMeals(mealPlanId: string): Promise<PlannedMeal[]> {
  const { data, error } = await supabase
    .from('planned_meals')
    .select(`
      *,
      food:foods (
        id,
        name,
        calories_per_serving,
        serving_size,
        serving_unit,
        protein_g,
        carbs_g,
        fat_g
      )
    `)
    .eq('meal_plan_id', mealPlanId)
    .order('date')
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as PlannedMeal[];
}

export async function getPlannedMealsByDateRange(
  startDate: string,
  endDate: string
): Promise<PlannedMeal[]> {
  const userId = getDemoUserId();

  // First get the user's meal plans in this date range
  const { data: plans, error: plansError } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', userId)
    .gte('week_start', startDate)
    .lte('week_start', endDate);

  if (plansError) throw plansError;
  if (!plans || plans.length === 0) return [];

  const planIds = plans.map(p => p.id);

  // Then get planned meals for those plans within the date range
  const { data, error } = await supabase
    .from('planned_meals')
    .select(`
      *,
      food:foods (
        id,
        name,
        calories_per_serving,
        serving_size,
        serving_unit,
        protein_g,
        carbs_g,
        fat_g
      )
    `)
    .in('meal_plan_id', planIds)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')
    .order('sort_order');

  if (error) throw error;
  return (data ?? []) as PlannedMeal[];
}

export async function addPlannedMeal(
  mealPlanId: string,
  meal: {
    date: string;
    meal_type: MealType;
    food_id?: string;
    custom_food_name?: string;
    servings?: number;
    notes?: string;
  }
): Promise<PlannedMeal> {
  const { data, error } = await supabase
    .from('planned_meals')
    .insert({
      meal_plan_id: mealPlanId,
      date: meal.date,
      meal_type: meal.meal_type,
      food_id: meal.food_id || null,
      custom_food_name: meal.custom_food_name || null,
      servings: meal.servings ?? 1,
      notes: meal.notes || null,
    })
    .select(`
      *,
      food:foods (
        id,
        name,
        calories_per_serving,
        serving_size,
        serving_unit,
        protein_g,
        carbs_g,
        fat_g
      )
    `)
    .single();

  if (error) throw error;
  return data as PlannedMeal;
}

export async function updatePlannedMeal(
  id: string,
  updates: {
    date?: string;
    meal_type?: MealType;
    servings?: number;
    notes?: string;
  }
): Promise<PlannedMeal> {
  const { data, error } = await supabase
    .from('planned_meals')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      food:foods (
        id,
        name,
        calories_per_serving,
        serving_size,
        serving_unit,
        protein_g,
        carbs_g,
        fat_g
      )
    `)
    .single();

  if (error) throw error;
  return data as PlannedMeal;
}

export async function deletePlannedMeal(id: string): Promise<void> {
  const { error } = await supabase
    .from('planned_meals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// CONVERSION: Planned Meal -> Logged Meal
// ============================================

export async function convertPlannedToLogged(
  plannedMealId: string
): Promise<{ mealLogId: string }> {
  const userId = getDemoUserId();

  // Get the planned meal
  const { data: plannedMeal, error: fetchError } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('id', plannedMealId)
    .single();

  if (fetchError) throw fetchError;
  if (!plannedMeal) throw new Error('Planned meal not found');

  // Create meal log
  const { data: mealLog, error: logError } = await supabase
    .from('meal_logs')
    .insert({
      user_id: userId,
      date: plannedMeal.date,
      meal_type: plannedMeal.meal_type,
      notes: plannedMeal.notes,
    })
    .select()
    .single();

  if (logError) throw logError;

  // Create meal item
  if (plannedMeal.food_id || plannedMeal.custom_food_name) {
    const { error: itemError } = await supabase
      .from('meal_items')
      .insert({
        meal_log_id: mealLog.id,
        food_id: plannedMeal.food_id,
        custom_food_name: plannedMeal.custom_food_name,
        servings: plannedMeal.servings,
      });

    if (itemError) throw itemError;
  }

  // Delete the planned meal
  await deletePlannedMeal(plannedMealId);

  return { mealLogId: mealLog.id };
}

// ============================================
// HELPERS
// ============================================

export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setDate(diff);
  return formatLocalDate(d);
}

export function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(formatLocalDate(date));
  }
  return dates;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ============================================
// MEAL TEMPLATES
// ============================================

export interface MealTemplateItem {
  food_name: string;
  servings: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface MealTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  meal_type: MealType | null;
  items: MealTemplateItem[];
  total_calories: number;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export async function getMealTemplates(): Promise<MealTemplate[]> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('user_id', userId)
    .order('use_count', { ascending: false })
    .order('name');

  if (error) throw error;
  return (data ?? []) as MealTemplate[];
}

export async function getMealTemplateById(id: string): Promise<MealTemplate | null> {
  const { data, error } = await supabase
    .from('meal_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as MealTemplate | null;
}

export async function createMealTemplate(template: {
  name: string;
  description?: string;
  meal_type?: MealType;
  items: MealTemplateItem[];
}): Promise<MealTemplate> {
  const userId = getDemoUserId();

  // Calculate totals
  const total_calories = template.items.reduce((sum, item) => sum + item.calories, 0);
  const total_protein = template.items.reduce((sum, item) => sum + (item.protein || 0), 0);
  const total_carbs = template.items.reduce((sum, item) => sum + (item.carbs || 0), 0);
  const total_fat = template.items.reduce((sum, item) => sum + (item.fat || 0), 0);

  const { data, error } = await supabase
    .from('meal_templates')
    .insert({
      user_id: userId,
      name: template.name,
      description: template.description || null,
      meal_type: template.meal_type || null,
      items: template.items,
      total_calories,
      total_protein,
      total_carbs,
      total_fat,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MealTemplate;
}

export async function updateMealTemplate(
  id: string,
  updates: {
    name?: string;
    description?: string;
    meal_type?: MealType;
    items?: MealTemplateItem[];
  }
): Promise<MealTemplate> {
  const updateData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // Recalculate totals if items changed
  if (updates.items) {
    updateData.total_calories = updates.items.reduce((sum, item) => sum + item.calories, 0);
    updateData.total_protein = updates.items.reduce((sum, item) => sum + (item.protein || 0), 0);
    updateData.total_carbs = updates.items.reduce((sum, item) => sum + (item.carbs || 0), 0);
    updateData.total_fat = updates.items.reduce((sum, item) => sum + (item.fat || 0), 0);
  }

  const { data, error } = await supabase
    .from('meal_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MealTemplate;
}

export async function deleteMealTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('meal_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function incrementTemplateUseCount(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_template_use_count', { template_id: id });

  // Fallback if RPC doesn't exist - just update directly
  if (error) {
    const template = await getMealTemplateById(id);
    if (template) {
      await supabase
        .from('meal_templates')
        .update({ use_count: (template.use_count || 0) + 1 })
        .eq('id', id);
    }
  }
}

// ============================================
// COPY FUNCTIONALITY
// ============================================

export async function copyPlannedMealToDate(
  plannedMealId: string,
  targetDate: string,
  targetMealType?: MealType
): Promise<PlannedMeal> {
  // Get the source meal
  const { data: sourceMeal, error: fetchError } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('id', plannedMealId)
    .single();

  if (fetchError) throw fetchError;
  if (!sourceMeal) throw new Error('Planned meal not found');

  // Get or create meal plan for target week
  const targetWeekStart = getWeekStart(new Date(targetDate));
  const plan = await getOrCreateMealPlan(targetWeekStart);

  // Create the copy
  return addPlannedMeal(plan.id, {
    date: targetDate,
    meal_type: targetMealType || sourceMeal.meal_type,
    food_id: sourceMeal.food_id,
    custom_food_name: sourceMeal.custom_food_name,
    servings: sourceMeal.servings,
    notes: sourceMeal.notes,
  });
}

export async function copyDayMeals(
  sourceDate: string,
  targetDate: string
): Promise<PlannedMeal[]> {
  const userId = getDemoUserId();

  // Get all planned meals for source date
  const { data: sourceMeals, error: fetchError } = await supabase
    .from('planned_meals')
    .select('*, meal_plan:meal_plans!inner(user_id)')
    .eq('date', sourceDate)
    .eq('meal_plan.user_id', userId);

  if (fetchError) throw fetchError;
  if (!sourceMeals || sourceMeals.length === 0) return [];

  // Get or create meal plan for target week
  const targetWeekStart = getWeekStart(new Date(targetDate));
  const plan = await getOrCreateMealPlan(targetWeekStart);

  // Copy each meal
  const copiedMeals: PlannedMeal[] = [];
  for (const meal of sourceMeals) {
    const copied = await addPlannedMeal(plan.id, {
      date: targetDate,
      meal_type: meal.meal_type,
      food_id: meal.food_id,
      custom_food_name: meal.custom_food_name,
      servings: meal.servings,
      notes: meal.notes,
    });
    copiedMeals.push(copied);
  }

  return copiedMeals;
}
