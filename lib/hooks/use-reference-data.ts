/**
 * Reference Data Hooks
 * Hooks for fetching reference data (nutrients, symptoms, supplements, etc.)
 */

import { useQuery } from '@tanstack/react-query';
import {
  getNutrients,
  getNutrientsByCategory,
  getSymptoms,
  getSymptomsByCategory,
  getHealthConditions,
  getSupplements,
  getSupplementById,
  searchSupplements,
  getFoods,
  searchFoods,
} from '@/lib/supabase/queries';

// ============================================
// NUTRIENTS
// ============================================

export function useNutrients() {
  return useQuery({
    queryKey: ['nutrients'],
    queryFn: getNutrients,
    staleTime: Infinity, // Reference data rarely changes
  });
}

export function useNutrientsByCategory(category: string) {
  return useQuery({
    queryKey: ['nutrients', 'category', category],
    queryFn: () => getNutrientsByCategory(category),
    staleTime: Infinity,
    enabled: !!category,
  });
}

// ============================================
// SYMPTOMS (Reference)
// ============================================

export function useSymptomsList() {
  return useQuery({
    queryKey: ['symptoms', 'list'],
    queryFn: getSymptoms,
    staleTime: 5 * 60 * 1000, // 5 minutes (can have custom symptoms)
  });
}

export function useSymptomsByCategory(category: string) {
  return useQuery({
    queryKey: ['symptoms', 'category', category],
    queryFn: () => getSymptomsByCategory(category),
    staleTime: 5 * 60 * 1000,
    enabled: !!category,
  });
}

// ============================================
// HEALTH CONDITIONS
// ============================================

export function useHealthConditionsList() {
  return useQuery({
    queryKey: ['health-conditions', 'list'],
    queryFn: getHealthConditions,
    staleTime: Infinity,
  });
}

// ============================================
// SUPPLEMENTS (Reference Database)
// ============================================

export function useSupplementsList() {
  return useQuery({
    queryKey: ['supplements', 'list'],
    queryFn: getSupplements,
    staleTime: 5 * 60 * 1000, // 5 minutes (can have user supplements)
  });
}

export function useSupplement(id: string | null) {
  return useQuery({
    queryKey: ['supplements', 'detail', id],
    queryFn: () => getSupplementById(id!),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useSupplementSearch(query: string) {
  return useQuery({
    queryKey: ['supplements', 'search', query],
    queryFn: () => searchSupplements(query),
    staleTime: 30 * 1000, // 30 seconds
    enabled: query.length >= 2,
  });
}

// ============================================
// FOODS
// ============================================

export function useFoodsList(limit = 100) {
  return useQuery({
    queryKey: ['foods', 'list', limit],
    queryFn: () => getFoods(limit),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: ['foods', 'search', query],
    queryFn: () => searchFoods(query),
    staleTime: 30 * 1000,
    enabled: query.length >= 2,
  });
}
