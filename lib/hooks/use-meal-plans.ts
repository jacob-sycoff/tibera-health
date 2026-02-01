/**
 * Meal Planning Hooks
 * React Query hooks for meal plans and planned meals
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMealPlans,
  getMealPlanByWeek,
  getOrCreateMealPlan,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  getPlannedMeals,
  getPlannedMealsByDateRange,
  addPlannedMeal,
  updatePlannedMeal,
  deletePlannedMeal,
  convertPlannedToLogged,
  getMealTemplates,
  createMealTemplate,
  updateMealTemplate,
  deleteMealTemplate,
  incrementTemplateUseCount,
  copyPlannedMealToDate,
  copyDayMeals,
  type MealPlan,
  type PlannedMeal,
  type MealType,
  type MealTemplate,
  type MealTemplateItem,
} from '@/lib/supabase/queries/meal-plans';

// Re-export types
export type { MealPlan, PlannedMeal, MealType, MealTemplate, MealTemplateItem };

// ============================================
// MEAL PLANS QUERIES
// ============================================

export function useMealPlans() {
  return useQuery({
    queryKey: ['meal-plans'],
    queryFn: getMealPlans,
  });
}

export function useMealPlanByWeek(weekStart: string | null) {
  return useQuery({
    queryKey: ['meal-plan', weekStart],
    queryFn: () => getMealPlanByWeek(weekStart!),
    enabled: !!weekStart,
  });
}

export function usePlannedMealsByDateRange(startDate: string | null, endDate: string | null) {
  return useQuery({
    queryKey: ['planned-meals', startDate, endDate],
    queryFn: () => getPlannedMealsByDateRange(startDate!, endDate!),
    enabled: !!startDate && !!endDate,
  });
}

// ============================================
// MEAL PLANS MUTATIONS
// ============================================

export function useCreateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ weekStart, name }: { weekStart: string; name?: string }) =>
      createMealPlan(weekStart, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
    },
  });
}

export function useGetOrCreateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (weekStart: string) => getOrCreateMealPlan(weekStart),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan', data.week_start] });
    },
  });
}

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string } }) =>
      updateMealPlan(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan', data.week_start] });
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-plans'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    },
  });
}

// ============================================
// PLANNED MEALS MUTATIONS
// ============================================

export function useAddPlannedMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealPlanId,
      meal,
    }: {
      mealPlanId: string;
      meal: {
        date: string;
        meal_type: MealType;
        food_id?: string;
        custom_food_name?: string;
        servings?: number;
        notes?: string;
      };
    }) => addPlannedMeal(mealPlanId, meal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    },
  });
}

export function useUpdatePlannedMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        date?: string;
        meal_type?: MealType;
        servings?: number;
        notes?: string;
      };
    }) => updatePlannedMeal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    },
  });
}

export function useDeletePlannedMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlannedMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    },
  });
}

// ============================================
// CONVERSION MUTATION
// ============================================

export function useConvertPlannedToLogged() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: convertPlannedToLogged,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
      queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
    },
  });
}

// ============================================
// MEAL TEMPLATES
// ============================================

export function useMealTemplates() {
  return useQuery({
    queryKey: ['meal-templates'],
    queryFn: getMealTemplates,
  });
}

export function useCreateMealTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: {
      name: string;
      description?: string;
      meal_type?: MealType;
      items: MealTemplateItem[];
    }) => createMealTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-templates'] });
    },
  });
}

export function useUpdateMealTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        name?: string;
        description?: string;
        meal_type?: MealType;
        items?: MealTemplateItem[];
      };
    }) => updateMealTemplate(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-templates'] });
    },
  });
}

export function useDeleteMealTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMealTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-templates'] });
    },
  });
}

export function useIncrementTemplateUseCount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: incrementTemplateUseCount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal-templates'] });
    },
  });
}

// ============================================
// COPY FUNCTIONALITY
// ============================================

export function useCopyPlannedMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      plannedMealId,
      targetDate,
      targetMealType,
    }: {
      plannedMealId: string;
      targetDate: string;
      targetMealType?: MealType;
    }) => copyPlannedMealToDate(plannedMealId, targetDate, targetMealType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    },
  });
}

export function useCopyDayMeals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceDate,
      targetDate,
    }: {
      sourceDate: string;
      targetDate: string;
    }) => copyDayMeals(sourceDate, targetDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-meals'] });
      queryClient.invalidateQueries({ queryKey: ['meal-plan'] });
    },
  });
}
