/**
 * Shopping Queries
 * Shopping lists and items
 */

import { supabase } from '../client';
import { requireAuthUserId } from '../constants';

// ============================================
// TYPES
// ============================================

export interface ShoppingItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  is_checked: boolean;
  from_meal_plan: boolean;
  meal_plan_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shopping_items: ShoppingItem[];
}

// ============================================
// SHOPPING LISTS
// ============================================

export async function getShoppingLists(): Promise<ShoppingList[]> {
  const userId = await requireAuthUserId();

  const { data, error } = await supabase
    .from('shopping_lists')
    .select(`
      *,
      shopping_items (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ShoppingList[];
}

export async function getShoppingListById(id: string) {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(`
      *,
      shopping_items (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getActiveShoppingList() {
  const userId = await requireAuthUserId();

  const { data, error } = await supabase
    .from('shopping_lists')
    .select(`
      *,
      shopping_items (*)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createShoppingList(name: string, setActive = true): Promise<ShoppingList> {
  const userId = await requireAuthUserId();

  // If setting as active, deactivate others first
  if (setActive) {
    await supabase
      .from('shopping_lists')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
  }

  const { data, error } = await supabase
    .from('shopping_lists')
    .insert({
      user_id: userId,
      name,
      is_active: setActive,
    })
    .select(`
      *,
      shopping_items (*)
    `)
    .single();

  if (error) throw error;
  return data as ShoppingList;
}

export async function updateShoppingList(
  id: string,
  updates: {
    name?: string;
    is_active?: boolean;
  }
): Promise<ShoppingList> {
  const userId = await requireAuthUserId();

  // If setting as active, deactivate others first
  if (updates.is_active) {
    await supabase
      .from('shopping_lists')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);
  }

  const { data, error } = await supabase
    .from('shopping_lists')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      shopping_items (*)
    `)
    .single();

  if (error) throw error;
  return data as ShoppingList;
}

export async function deleteShoppingList(id: string) {
  // Items will be cascade deleted
  const { error } = await supabase
    .from('shopping_lists')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// SHOPPING ITEMS
// ============================================

export async function addShoppingItem(
  listId: string,
  item: {
    name: string;
    quantity?: number;
    unit?: string;
    category?: string;
    from_meal_plan?: boolean;
    meal_plan_id?: string;
  }
) {
  // Get max sort order
  const { data: existingItems } = await supabase
    .from('shopping_items')
    .select('sort_order')
    .eq('list_id', listId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = (existingItems?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      list_id: listId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category ?? 'other',
      is_checked: false,
      from_meal_plan: item.from_meal_plan ?? false,
      meal_plan_id: item.meal_plan_id,
      sort_order: nextSortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateShoppingItem(
  id: string,
  updates: {
    name?: string;
    quantity?: number;
    unit?: string;
    category?: string;
    is_checked?: boolean;
    sort_order?: number;
  }
) {
  const { data, error } = await supabase
    .from('shopping_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleShoppingItem(id: string) {
  // Get current state
  const { data: current } = await supabase
    .from('shopping_items')
    .select('is_checked')
    .eq('id', id)
    .single();

  if (!current) return;

  const { data, error } = await supabase
    .from('shopping_items')
    .update({ is_checked: !current.is_checked })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteShoppingItem(id: string) {
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function clearCheckedItems(listId: string) {
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('list_id', listId)
    .eq('is_checked', true);

  if (error) throw error;
}

// ============================================
// BATCH OPERATIONS
// ============================================

export async function addItemsFromMealPlan(
  listId: string,
  mealPlanId: string,
  items: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    category?: string;
  }>
) {
  // Get max sort order
  const { data: existingItems } = await supabase
    .from('shopping_items')
    .select('sort_order')
    .eq('list_id', listId)
    .order('sort_order', { ascending: false })
    .limit(1);

  let sortOrder = (existingItems?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('shopping_items')
    .insert(
      items.map(item => ({
        list_id: listId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category ?? 'other',
        is_checked: false,
        from_meal_plan: true,
        meal_plan_id: mealPlanId,
        sort_order: sortOrder++,
      }))
    )
    .select();

  if (error) throw error;
  return data;
}

// ============================================
// GENERATE FROM MEAL PLAN
// ============================================

export async function generateShoppingListFromPlan(
  startDate: string,
  endDate: string,
  listName?: string
): Promise<ShoppingList> {
  const userId = await requireAuthUserId();

  // Get planned meals in the date range
  const { data: plans } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('user_id', userId);

  if (!plans || plans.length === 0) {
    throw new Error('No meal plans found');
  }

  const planIds = plans.map(p => p.id);

  const { data: plannedMeals, error: mealsError } = await supabase
    .from('planned_meals')
    .select(`
      *,
      food:foods (
        name
      )
    `)
    .in('meal_plan_id', planIds)
    .gte('date', startDate)
    .lte('date', endDate);

  if (mealsError) throw mealsError;

  if (!plannedMeals || plannedMeals.length === 0) {
    throw new Error('No planned meals found in this date range');
  }

  // Create a new shopping list
  const list = await createShoppingList(
    listName || `Shopping List (${startDate} - ${endDate})`,
    true
  );

  // Aggregate items (combine same foods)
  const itemMap = new Map<string, { name: string; quantity: number }>();

  for (const meal of plannedMeals) {
    const foodName = meal.custom_food_name || meal.food?.name || 'Unknown food';
    const existing = itemMap.get(foodName);
    if (existing) {
      existing.quantity += meal.servings;
    } else {
      itemMap.set(foodName, {
        name: foodName,
        quantity: meal.servings,
      });
    }
  }

  // Add items to the list
  const items = Array.from(itemMap.values()).map(item => ({
    name: item.name,
    quantity: item.quantity,
    unit: 'serving(s)',
    category: 'food',
  }));

  if (items.length > 0) {
    await addItemsFromMealPlan(list.id, planIds[0], items);
  }

  // Return the updated list
  return getShoppingListById(list.id) as Promise<ShoppingList>;
}
