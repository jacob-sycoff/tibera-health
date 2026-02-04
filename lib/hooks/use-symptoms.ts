/**
 * Symptoms Hooks
 * Hooks for symptom logs and tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSymptomLogs,
  getSymptomLogsByDate,
  getSymptomLogById,
  createSymptomLog,
  updateSymptomLog,
  deleteSymptomLog,
  createCustomSymptom,
  getSymptomStats,
} from '@/lib/supabase/queries';
import { localDateISO } from '@/lib/utils/dates';

// ============================================
// SYMPTOM LOGS
// ============================================

export function useSymptomLogs(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['symptom-logs', startDate, endDate],
    queryFn: () => getSymptomLogs(startDate, endDate),
  });
}

export function useSymptomLogsByDate(date: string) {
  return useQuery({
    queryKey: ['symptom-logs', 'date', date],
    queryFn: () => getSymptomLogsByDate(date),
    enabled: !!date,
  });
}

export function useSymptomLog(id: string | null) {
  return useQuery({
    queryKey: ['symptom-logs', 'detail', id],
    queryFn: () => getSymptomLogById(id!),
    enabled: !!id,
  });
}

// ============================================
// MUTATIONS
// ============================================

export function useCreateSymptomLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSymptomLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptom-logs'] });
      queryClient.invalidateQueries({ queryKey: ['symptom-stats'] });
    },
  });
}

export function useUpdateSymptomLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateSymptomLog>[1] }) =>
      updateSymptomLog(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['symptom-logs'] });
      queryClient.invalidateQueries({ queryKey: ['symptom-stats'] });
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['symptom-logs', 'detail', data.id] });
      }
    },
  });
}

export function useDeleteSymptomLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSymptomLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptom-logs'] });
      queryClient.invalidateQueries({ queryKey: ['symptom-stats'] });
    },
  });
}

// ============================================
// CUSTOM SYMPTOMS
// ============================================

export function useCreateCustomSymptom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCustomSymptom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['symptoms', 'list'] });
    },
  });
}

// ============================================
// STATISTICS
// ============================================

export function useSymptomStats(days: number = 7) {
  return useQuery({
    queryKey: ['symptom-stats', days],
    queryFn: () => getSymptomStats(days),
  });
}

// ============================================
// TODAY'S SYMPTOMS
// ============================================

export function useTodaysSymptoms() {
  const today = localDateISO();
  return useSymptomLogsByDate(today);
}
