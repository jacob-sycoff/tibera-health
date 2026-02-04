/**
 * Supplements Hooks
 * Hooks for supplement logs and tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSupplementLogs,
  getSupplementLogsByDate,
  getSupplementLogById,
  createSupplementLog,
  updateSupplementLog,
  deleteSupplementLog,
  createUserSupplement,
  updateSupplement,
  deleteSupplement,
  getSupplementStats,
  getPillOrganizerItems,
  addPillOrganizerItem,
  removePillOrganizerItem,
  reorderPillOrganizerItems,
} from '@/lib/supabase/queries';
import type { PillOrganizerItem } from '@/lib/supabase/queries/supplements';
import { localDateISO } from '@/lib/utils/dates';

// ============================================
// SUPPLEMENT LOGS
// ============================================

export function useSupplementLogs(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['supplement-logs', startDate, endDate],
    queryFn: () => getSupplementLogs(startDate, endDate),
  });
}

export function useSupplementLogsByDate(date: string) {
  return useQuery({
    queryKey: ['supplement-logs', 'date', date],
    queryFn: () => getSupplementLogsByDate(date),
    enabled: !!date,
  });
}

export function useSupplementLog(id: string | null) {
  return useQuery({
    queryKey: ['supplement-logs', 'detail', id],
    queryFn: () => getSupplementLogById(id!),
    enabled: !!id,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateSupplementLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplementLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplement-logs'] });
      queryClient.invalidateQueries({ queryKey: ['supplement-stats'] });
    },
    onError: (error: unknown) => {
      // Extract useful error info from Supabase errors
      const err = error as { message?: string; code?: string; details?: string; hint?: string };
      console.error('Failed to create supplement log:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        raw: error,
      });
    },
  });
}

export function useUpdateSupplementLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateSupplementLog>[1] }) =>
      updateSupplementLog(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['supplement-logs'] });
      queryClient.invalidateQueries({ queryKey: ['supplement-stats'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['supplement-logs', 'detail', data.id] });
      }
    },
  });
}

export function useDeleteSupplementLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplementLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplement-logs'] });
      queryClient.invalidateQueries({ queryKey: ['supplement-stats'] });
    },
  });
}

// ============================================
// USER SUPPLEMENTS
// ============================================

export function useCreateUserSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createUserSupplement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements', 'list'] });
    },
  });
}

export function useUpdateSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSupplement>[1] }) =>
      updateSupplement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['pill-organizer'] });
    },
  });
}

export function useDeleteSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['pill-organizer'] });
    },
  });
}

// ============================================
// STATISTICS
// ============================================

export function useSupplementStats(days: number = 7) {
  return useQuery({
    queryKey: ['supplement-stats', days],
    queryFn: () => getSupplementStats(days),
  });
}

// ============================================
// TODAY'S SUPPLEMENTS
// ============================================

export function useTodaysSupplements() {
  const today = localDateISO();
  return useSupplementLogsByDate(today);
}

// ============================================
// PILL ORGANIZER
// ============================================

export function usePillOrganizerItems() {
  return useQuery({
    queryKey: ['pill-organizer'],
    queryFn: getPillOrganizerItems,
  });
}

export function useAddPillOrganizerItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addPillOrganizerItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pill-organizer'] });
    },
  });
}

export function useRemovePillOrganizerItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removePillOrganizerItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pill-organizer'] });
    },
  });
}

export function useReorderPillOrganizerItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderPillOrganizerItems,
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['pill-organizer'] });
      const previous = queryClient.getQueryData<PillOrganizerItem[]>(['pill-organizer']);

      if (previous) {
        const reordered = orderedIds
          .map((id) => previous.find((item) => item.id === id))
          .filter(Boolean) as PillOrganizerItem[];
        queryClient.setQueryData(['pill-organizer'], reordered);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['pill-organizer'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pill-organizer'] });
    },
  });
}
