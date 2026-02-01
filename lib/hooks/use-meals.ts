/**
 * Meals Hooks
 * Hooks for meal logs and tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMealLogs,
  getMealLogsByDate,
  getMealLogById,
  createMealLog,
  updateMealLog,
  deleteMealLog,
  addMealItem,
  updateMealItem,
  deleteMealItem,
  type MealLog,
  type MealItem,
} from '@/lib/supabase/queries';

// Re-export types for consumers
export type { MealLog, MealItem };

// ============================================
// MEAL LOGS
// ============================================

export function useMealLogs(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['meal-logs', startDate, endDate],
    queryFn: () => getMealLogs(startDate, endDate),
  });
}

export function useMealLogsByDate(date: string) {
  return useQuery({
    queryKey: ['meal-logs', 'date', date],
    queryFn: () => getMealLogsByDate(date),
    enabled: !!date,
  });
}

export function useMealLog(id: string | null) {
  return useQuery({
    queryKey: ['meal-logs', 'detail', id],
    queryFn: () => getMealLogById(id!),
    enabled: !!id,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateMealLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMealLog,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
      if (data?.date) {
        queryClient.invalidateQueries({ queryKey: ['meal-logs', 'date', data.date] });
      }
    },
  });
}

export function useUpdateMealLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateMealLog>[1] }) =>
      updateMealLog(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['meal-logs', 'detail', data.id] });
      }
    },
  });
}

export function useDeleteMealLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
  });
}

// ============================================
// MEAL ITEMS
// ============================================

export function useAddMealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mealLogId, item }: { mealLogId: string; item: Parameters<typeof addMealItem>[1] }) =>
      addMealItem(mealLogId, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
  });
}

export function useUpdateMealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateMealItem>[1] }) =>
      updateMealItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
  });
}

export function useDeleteMealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
  });
}

// ============================================
// TODAY'S MEALS HELPER
// ============================================

export function useTodaysMeals() {
  const today = new Date().toISOString().split('T')[0];
  return useMealLogsByDate(today);
}
