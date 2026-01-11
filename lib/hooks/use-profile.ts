/**
 * Profile Hooks
 * Hooks for user profile, preferences, goals, and health conditions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getProfile,
  upsertProfile,
  getPreferences,
  upsertPreferences,
  getGoals,
  upsertGoals,
  getUserHealthConditions,
  setHealthConditions,
} from '@/lib/supabase/queries';

// ============================================
// PROFILE
// ============================================

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// ============================================
// PREFERENCES
// ============================================

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: getPreferences,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
    },
  });
}

// ============================================
// GOALS
// ============================================

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
  });
}

export function useUpdateGoals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertGoals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

// ============================================
// USER HEALTH CONDITIONS
// ============================================

export function useUserHealthConditions() {
  return useQuery({
    queryKey: ['user-health-conditions'],
    queryFn: getUserHealthConditions,
  });
}

export function useSetHealthConditions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setHealthConditions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-health-conditions'] });
    },
  });
}

// ============================================
// COMBINED PROFILE DATA
// ============================================

export function useFullProfile() {
  const profile = useProfile();
  const preferences = usePreferences();
  const goals = useGoals();
  const conditions = useUserHealthConditions();

  return {
    profile: profile.data,
    preferences: preferences.data,
    goals: goals.data,
    conditions: conditions.data,
    isLoading: profile.isLoading || preferences.isLoading || goals.isLoading || conditions.isLoading,
    error: profile.error || preferences.error || goals.error || conditions.error,
  };
}
