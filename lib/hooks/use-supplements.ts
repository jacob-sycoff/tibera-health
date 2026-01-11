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
  getSupplementStats,
} from '@/lib/supabase/queries';

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
  const today = new Date().toISOString().split('T')[0];
  return useSupplementLogsByDate(today);
}
