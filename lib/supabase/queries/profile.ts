/**
 * Profile Queries
 * User profile, preferences, goals, and health conditions
 *
 * AUTH NOTE: All functions use getDemoUserId() which should be
 * replaced with actual auth user ID when implementing auth.
 */

import { supabase } from '../client';
import { getDemoUserId } from '../constants';

// ============================================
// PROFILE
// ============================================

export async function getProfile() {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function upsertProfile(profile: {
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
}) {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// USER PREFERENCES
// ============================================

export async function getPreferences() {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertPreferences(preferences: {
  units?: string;
  theme?: string;
  notifications_enabled?: boolean;
}) {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// USER GOALS
// ============================================

export interface UserGoals {
  id: string;
  user_id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  custom_nutrients: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export async function getGoals(): Promise<UserGoals | null> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as UserGoals | null;
}

export async function upsertGoals(goals: {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  custom_nutrients?: Record<string, number>;
  customNutrients?: Record<string, number>;
}) {
  const userId = getDemoUserId();

  const { customNutrients: camelCustom, custom_nutrients: snakeCustom, ...rest } = goals;
  const customNutrients = snakeCustom ?? camelCustom ?? undefined;

  const { data, error } = await supabase
    .from('user_goals')
    .upsert({
      user_id: userId,
      ...rest,
      ...(customNutrients !== undefined ? { custom_nutrients: customNutrients } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// GOAL EVENT HISTORY
// ============================================

export async function insertGoalEvent(event: {
  event_type: 'micronutrient_set' | 'micronutrient_remove' | 'macros_saved';
  nutrient_key?: string | null;
  amount?: number | null;
  unit?: string | null;
  prev_amount?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const userId = getDemoUserId();

  const payload = {
    user_id: userId,
    event_type: event.event_type,
    nutrient_key: event.nutrient_key ?? null,
    amount: event.amount ?? null,
    unit: event.unit ?? null,
    prev_amount: event.prev_amount ?? null,
    metadata: event.metadata ?? {},
  };

  const { data, error } = await supabase
    .from('user_goal_events')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// USER HEALTH CONDITIONS
// ============================================

export async function getUserHealthConditions() {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('user_health_conditions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null);

  if (error) throw error;
  return data ?? [];
}

export async function addHealthCondition(conditionCode: string, notes?: string) {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('user_health_conditions')
    .insert({
      user_id: userId,
      condition_code: conditionCode,
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeHealthCondition(conditionCode: string) {
  const userId = getDemoUserId();

  const { error } = await supabase
    .from('user_health_conditions')
    .update({ ended_at: new Date().toISOString().split('T')[0] })
    .eq('user_id', userId)
    .eq('condition_code', conditionCode);

  if (error) throw error;
}

export async function setHealthConditions(conditionCodes: string[]) {
  const userId = getDemoUserId();

  // End all current conditions
  await supabase
    .from('user_health_conditions')
    .update({ ended_at: new Date().toISOString().split('T')[0] })
    .eq('user_id', userId)
    .is('ended_at', null);

  // Add new conditions (if not 'none')
  if (conditionCodes.length > 0 && !conditionCodes.includes('none')) {
    const { error } = await supabase
      .from('user_health_conditions')
      .insert(
        conditionCodes.map(code => ({
          user_id: userId,
          condition_code: code,
        }))
      );

    if (error) throw error;
  }
}
