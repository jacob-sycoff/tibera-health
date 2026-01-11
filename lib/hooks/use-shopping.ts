/**
 * Shopping Hooks
 * Hooks for shopping lists and items
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShoppingLists,
  getShoppingListById,
  getActiveShoppingList,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  addShoppingItem,
  updateShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  clearCheckedItems,
  addItemsFromMealPlan,
} from '@/lib/supabase/queries';

// ============================================
// SHOPPING LISTS
// ============================================

export function useShoppingLists() {
  return useQuery({
    queryKey: ['shopping-lists'],
    queryFn: getShoppingLists,
  });
}

export function useShoppingList(id: string | null) {
  return useQuery({
    queryKey: ['shopping-lists', 'detail', id],
    queryFn: () => getShoppingListById(id!),
    enabled: !!id,
  });
}

export function useActiveShoppingList() {
  return useQuery({
    queryKey: ['shopping-lists', 'active'],
    queryFn: getActiveShoppingList,
  });
}

// ============================================
// LIST MUTATIONS
// ============================================

export function useCreateShoppingList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, setActive = true }: { name: string; setActive?: boolean }) =>
      createShoppingList(name, setActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

export function useUpdateShoppingList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateShoppingList>[1] }) =>
      updateShoppingList(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['shopping-lists', 'detail', data.id] });
      }
    },
  });
}

export function useDeleteShoppingList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteShoppingList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

// ============================================
// ITEM MUTATIONS
// ============================================

export function useAddShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ listId, item }: { listId: string; item: Parameters<typeof addShoppingItem>[1] }) =>
      addShoppingItem(listId, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateShoppingItem>[1] }) =>
      updateShoppingItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

export function useToggleShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleShoppingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteShoppingItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

export function useClearCheckedItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearCheckedItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}

// ============================================
// MEAL PLAN INTEGRATION
// ============================================

export function useAddItemsFromMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      listId,
      mealPlanId,
      items,
    }: {
      listId: string;
      mealPlanId: string;
      items: Parameters<typeof addItemsFromMealPlan>[2];
    }) => addItemsFromMealPlan(listId, mealPlanId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
  });
}
