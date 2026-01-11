/**
 * Sleep Hooks
 * Hooks for sleep logs and tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSleepLogs,
  getSleepLogByDate,
  getSleepLogById,
  createSleepLog,
  updateSleepLog,
  upsertSleepLog,
  deleteSleepLog,
  getSleepStats,
} from '@/lib/supabase/queries';

// ============================================
// SLEEP LOGS
// ============================================

export function useSleepLogs(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['sleep-logs', startDate, endDate],
    queryFn: () => getSleepLogs(startDate, endDate),
  });
}

export function useSleepLogByDate(date: string) {
  return useQuery({
    queryKey: ['sleep-logs', 'date', date],
    queryFn: () => getSleepLogByDate(date),
    enabled: !!date,
  });
}

export function useSleepLog(id: string | null) {
  return useQuery({
    queryKey: ['sleep-logs', 'detail', id],
    queryFn: () => getSleepLogById(id!),
    enabled: !!id,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateSleepLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSleepLog,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sleep-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sleep-stats'] });
      if (data?.date) {
        queryClient.invalidateQueries({ queryKey: ['sleep-logs', 'date', data.date] });
      }
    },
  });
}

export function useUpdateSleepLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateSleepLog>[1] }) =>
      updateSleepLog(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sleep-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sleep-stats'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['sleep-logs', 'detail', data.id] });
      }
    },
  });
}

export function useUpsertSleepLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertSleepLog,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sleep-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sleep-stats'] });
      if (data?.date) {
        queryClient.invalidateQueries({ queryKey: ['sleep-logs', 'date', data.date] });
      }
    },
  });
}

export function useDeleteSleepLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSleepLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sleep-stats'] });
    },
  });
}

// ============================================
// STATISTICS
// ============================================

export function useSleepStats(days: number = 7) {
  return useQuery({
    queryKey: ['sleep-stats', days],
    queryFn: () => getSleepStats(days),
  });
}

// ============================================
// TODAY'S SLEEP (last night's log)
// ============================================

export function useLastNightsSleep() {
  const today = new Date().toISOString().split('T')[0];
  return useSleepLogByDate(today);
}
