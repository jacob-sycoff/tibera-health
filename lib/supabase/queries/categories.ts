/**
 * Category Query Functions
 * Fetches reference data for symptom and shopping categories
 */

import { supabase } from '../client';

// ============================================
// TYPES
// ============================================

export interface SymptomCategoryRecord {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
}

export interface ShoppingCategoryRecord {
  id: string;
  slug: string;
  label: string;
  sort_order: number;
}

// ============================================
// SYMPTOM CATEGORIES
// ============================================

export async function getSymptomCategories(): Promise<SymptomCategoryRecord[]> {
  const { data, error } = await supabase
    .from('symptom_categories')
    .select('id, slug, label, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching symptom categories:', error);
    return [];
  }

  return data || [];
}

// ============================================
// SHOPPING CATEGORIES
// ============================================

export async function getShoppingCategories(): Promise<ShoppingCategoryRecord[]> {
  const { data, error } = await supabase
    .from('shopping_categories')
    .select('id, slug, label, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching shopping categories:', error);
    return [];
  }

  return data || [];
}
