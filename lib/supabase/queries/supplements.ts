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

  console.log('Creating supplement log with:', { userId, log });

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

  if (error) {
    console.error('Supabase error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
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
// FORM MAPPING HELPER
// ============================================

// Valid nutrient_form enum values
const VALID_FORMS = new Set([
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
]);

// Map free-text form names to enum values
const FORM_MAPPINGS: Record<string, string> = {
  'cholecalciferol': 'd3_cholecalciferol',
  'd3': 'd3_cholecalciferol',
  'vitamin d3': 'd3_cholecalciferol',
  'ergocalciferol': 'd2_ergocalciferol',
  'd2': 'd2_ergocalciferol',
  'vitamin d2': 'd2_ergocalciferol',
  'methylcobalamin': 'methylcobalamin',
  'methyl b12': 'methylcobalamin',
  'cyanocobalamin': 'cyanocobalamin',
  'methylfolate': 'methylfolate',
  '5-mthf': 'methylfolate',
  'l-methylfolate': 'methylfolate',
  'folic acid': 'folic_acid',
  'folate': 'folic_acid',
  'ascorbic acid': 'ascorbic_acid',
  'sodium ascorbate': 'sodium_ascorbate',
  'magnesium citrate': 'citrate',
  'citrate': 'citrate',
  'magnesium oxide': 'oxide',
  'oxide': 'oxide',
  'magnesium glycinate': 'glycinate',
  'glycinate': 'glycinate',
  'chelated': 'chelated',
  'bisglycinate': 'bisglycinate',
  'magnesium bisglycinate': 'bisglycinate',
  'threonate': 'threonate',
  'magnesium threonate': 'threonate',
  'malate': 'malate',
  'magnesium malate': 'malate',
  'taurate': 'taurate',
  'magnesium taurate': 'taurate',
  'picolinate': 'picolinate',
  'zinc picolinate': 'picolinate',
  'sulfate': 'sulfate',
  'gluconate': 'gluconate',
  'carbonate': 'carbonate',
  'ferrous sulfate': 'ferrous_sulfate',
  'ferrous gluconate': 'ferrous_gluconate',
  'ferrous bisglycinate': 'ferrous_bisglycinate',
  'iron bisglycinate': 'ferrous_bisglycinate',
  'heme iron': 'heme_iron',
  'retinyl palmitate': 'retinyl_palmitate',
  'beta carotene': 'beta_carotene',
  'beta-carotene': 'beta_carotene',
  'mixed tocopherols': 'mixed_tocopherols',
  'd-alpha tocopherol': 'd_alpha_tocopherol',
  'dl-alpha tocopherol': 'dl_alpha_tocopherol',
  'vitamin k1': 'k1_phylloquinone',
  'phylloquinone': 'k1_phylloquinone',
  'vitamin k2': 'k2_mk7',
  'mk-7': 'k2_mk7',
  'mk7': 'k2_mk7',
  'mk-4': 'k2_mk4',
  'mk4': 'k2_mk4',
  'thiamine hcl': 'thiamine_hcl',
  'benfotiamine': 'benfotiamine',
  'riboflavin': 'riboflavin',
  'riboflavin 5 phosphate': 'riboflavin_5_phosphate',
  'niacinamide': 'niacinamide',
  'nicotinic acid': 'nicotinic_acid',
  'niacin': 'nicotinic_acid',
  'pyridoxine hcl': 'pyridoxine_hcl',
  'pyridoxal 5 phosphate': 'pyridoxal_5_phosphate',
  'p5p': 'pyridoxal_5_phosphate',
};

function mapFormToEnum(form: string | undefined): { enumValue: string; originalForm: string | null } {
  if (!form) return { enumValue: 'unknown', originalForm: null };

  const normalized = form.toLowerCase().trim();

  // Check if it's already a valid enum value
  if (VALID_FORMS.has(normalized)) {
    return { enumValue: normalized, originalForm: null };
  }

  // Try to map it
  const mapped = FORM_MAPPINGS[normalized];
  if (mapped) {
    return { enumValue: mapped, originalForm: null };
  }

  // Can't map - return unknown and preserve original
  return { enumValue: 'unknown', originalForm: form };
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
  attributes?: Record<string, unknown>;
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

  console.log('Creating user supplement:', { name: supplement.name, userId });

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
      attributes: supplement.attributes ?? {},
      is_verified: false,
      created_by: 'user',
      created_by_user: userId,
    })
    .select()
    .single();

  if (supplementError) {
    console.error('Supabase supplement insert error:', {
      message: supplementError.message,
      code: supplementError.code,
      details: supplementError.details,
      hint: supplementError.hint,
    });
    throw supplementError;
  }

  // Create ingredients
  if (supplement.ingredients.length > 0) {
    console.log('Creating ingredients:', supplement.ingredients.length);
    const { error: ingredientsError } = await supabase
      .from('supplement_ingredients')
      .insert(
        supplement.ingredients.map((ing, idx) => {
          // Map free-text form to enum value
          const { enumValue, originalForm } = mapFormToEnum(ing.form);
          // Combine original form with notes if form couldn't be mapped
          const notes = originalForm
            ? `Form: ${originalForm}${ing.notes ? `. ${ing.notes}` : ''}`
            : ing.notes;

          return {
            supplement_id: supplementData.id,
            nutrient_id: ing.nutrient_id,
            nutrient_name: ing.nutrient_name,
            amount: ing.amount,
            unit: ing.unit,
            daily_value_percent: ing.daily_value_percent,
            form: enumValue,
            source: ing.source ?? 'unknown',
            notes,
            sort_order: idx,
          };
        })
      );

    if (ingredientsError) {
      console.error('Supabase ingredients insert error:', {
        message: ingredientsError.message,
        code: ingredientsError.code,
        details: ingredientsError.details,
        hint: ingredientsError.hint,
      });
      throw ingredientsError;
    }
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

// ============================================
// PILL ORGANIZER
// ============================================

export interface PillOrganizerItem {
  id: string;
  user_id: string;
  supplement_id: string;
  sort_order: number;
  created_at: string;
  supplement: {
    id: string;
    name: string;
    brand: string | null;
    type: string;
    serving_size: string | null;
    supplement_ingredients: Array<{
      id: string;
      nutrient_name: string;
      amount: number;
      unit: string;
      daily_value_percent: number | null;
      form: string | null;
      source: string | null;
      notes: string | null;
    }>;
  };
}

export async function getPillOrganizerItems(): Promise<PillOrganizerItem[]> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('pill_organizer_items')
    .select(`
      *,
      supplement:supplements (
        id, name, brand, type, serving_size,
        supplement_ingredients (*)
      )
    `)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PillOrganizerItem[];
}

export async function addPillOrganizerItem(
  supplementId: string
): Promise<PillOrganizerItem> {
  const userId = getDemoUserId();

  // Get current max sort_order for this user
  const { data: existing } = await supabase
    .from('pill_organizer_items')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('pill_organizer_items')
    .insert({
      user_id: userId,
      supplement_id: supplementId,
      sort_order: nextOrder,
    })
    .select(`
      *,
      supplement:supplements (
        id, name, brand, type, serving_size,
        supplement_ingredients (*)
      )
    `)
    .single();

  if (error) throw error;
  return data as PillOrganizerItem;
}

export async function removePillOrganizerItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('pill_organizer_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderPillOrganizerItems(
  orderedIds: string[]
): Promise<void> {
  const userId = getDemoUserId();

  const updates = orderedIds.map((id, index) =>
    supabase
      .from('pill_organizer_items')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('user_id', userId)
  );

  const results = await Promise.all(updates);
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw firstError.error;
}
