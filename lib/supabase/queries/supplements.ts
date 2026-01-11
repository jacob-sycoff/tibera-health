/**
 * Supplement Queries
 * Supplement logs and tracking
 */

import { supabase } from '../client';
import { getDemoUserId } from '../constants';

// ============================================
// TYPES
// ============================================

export interface SupplementLog {
  id: string;
  user_id: string;
  supplement_id: string | null;
  supplement_name: string;
  dosage: number;
  unit: string;
  logged_at: string;
  notes: string | null;
  created_at: string;
  supplement?: {
    id: string;
    name: string;
    brand: string | null;
    [key: string]: unknown;
  } | null;
}

// ============================================
// SUPPLEMENT LOGS
// ============================================

export async function getSupplementLogs(startDate?: string, endDate?: string): Promise<SupplementLog[]> {
  const userId = getDemoUserId();

  let query = supabase
    .from('supplement_logs')
    .select(`
      *,
      supplement:supplements (
        *,
        supplement_ingredients (*)
      )
    `)
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });

  if (startDate) {
    query = query.gte('logged_at', `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte('logged_at', `${endDate}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as SupplementLog[];
}

export async function getSupplementLogsByDate(date: string): Promise<SupplementLog[]> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('supplement_logs')
    .select(`
      *,
      supplement:supplements (
        *,
        supplement_ingredients (*)
      )
    `)
    .eq('user_id', userId)
    .gte('logged_at', `${date}T00:00:00`)
    .lte('logged_at', `${date}T23:59:59`)
    .order('logged_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SupplementLog[];
}

export async function getSupplementLogById(id: string): Promise<SupplementLog | null> {
  const { data, error } = await supabase
    .from('supplement_logs')
    .select(`
      *,
      supplement:supplements (
        *,
        supplement_ingredients (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as SupplementLog | null;
}

export async function createSupplementLog(log: {
  supplement_id?: string;
  supplement_name: string;
  dosage: number;
  unit: string;
  logged_at?: string;
  notes?: string;
}): Promise<SupplementLog> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('supplement_logs')
    .insert({
      user_id: userId,
      supplement_id: log.supplement_id,
      supplement_name: log.supplement_name,
      dosage: log.dosage,
      unit: log.unit,
      logged_at: log.logged_at ?? new Date().toISOString(),
      notes: log.notes,
    })
    .select(`
      *,
      supplement:supplements (
        *,
        supplement_ingredients (*)
      )
    `)
    .single();

  if (error) throw error;
  return data as SupplementLog;
}

export async function updateSupplementLog(
  id: string,
  updates: {
    dosage?: number;
    unit?: string;
    logged_at?: string;
    notes?: string;
  }
): Promise<SupplementLog> {
  const { data, error } = await supabase
    .from('supplement_logs')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      supplement:supplements (
        *,
        supplement_ingredients (*)
      )
    `)
    .single();

  if (error) throw error;
  return data as SupplementLog;
}

export async function deleteSupplementLog(id: string) {
  const { error } = await supabase
    .from('supplement_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// USER SUPPLEMENTS (Custom)
// ============================================

export async function createUserSupplement(supplement: {
  name: string;
  brand?: string;
  type: string;
  serving_size: string;
  servings_per_container?: number;
  other_ingredients?: string[];
  allergens?: string[];
  certifications?: string[];
  ingredients: Array<{
    nutrient_id?: string;
    nutrient_name: string;
    amount: number;
    unit: string;
    daily_value_percent?: number;
    form?: string;
    source?: string;
    notes?: string;
  }>;
}) {
  const userId = getDemoUserId();

  // Create supplement
  const { data: supplementData, error: supplementError } = await supabase
    .from('supplements')
    .insert({
      name: supplement.name,
      brand: supplement.brand,
      type: supplement.type,
      serving_size: supplement.serving_size,
      servings_per_container: supplement.servings_per_container,
      other_ingredients: supplement.other_ingredients,
      allergens: supplement.allergens,
      certifications: supplement.certifications,
      is_verified: false,
      created_by: 'user',
      created_by_user: userId,
    })
    .select()
    .single();

  if (supplementError) throw supplementError;

  // Create ingredients
  if (supplement.ingredients.length > 0) {
    const { error: ingredientsError } = await supabase
      .from('supplement_ingredients')
      .insert(
        supplement.ingredients.map((ing, idx) => ({
          supplement_id: supplementData.id,
          nutrient_id: ing.nutrient_id,
          nutrient_name: ing.nutrient_name,
          amount: ing.amount,
          unit: ing.unit,
          daily_value_percent: ing.daily_value_percent,
          form: ing.form ?? 'unknown',
          source: ing.source ?? 'unknown',
          notes: ing.notes,
          sort_order: idx,
        }))
      );

    if (ingredientsError) throw ingredientsError;
  }

  // Return full supplement with ingredients
  const { data, error } = await supabase
    .from('supplements')
    .select(`
      *,
      supplement_ingredients (*)
    `)
    .eq('id', supplementData.id)
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// SUPPLEMENT STATISTICS
// ============================================

export async function getSupplementStats(days: number = 7) {
  const userId = getDemoUserId();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: false });

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      totalLogs: 0,
      uniqueSupplements: 0,
      supplementCounts: {},
    };
  }

  // Count by supplement
  const supplementCounts: Record<string, number> = {};
  data.forEach(log => {
    const name = log.supplement_name;
    supplementCounts[name] = (supplementCounts[name] || 0) + 1;
  });

  return {
    totalLogs: data.length,
    uniqueSupplements: Object.keys(supplementCounts).length,
    supplementCounts,
  };
}
