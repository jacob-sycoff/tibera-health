/**
 * Sleep Queries
 * Sleep logs and tracking
 */

import { supabase } from '../client';
import { getDemoUserId } from '../constants';

// ============================================
// TYPES
// ============================================

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  duration_minutes: number;
  quality: '1' | '2' | '3' | '4' | '5';
  factors: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// SLEEP LOGS
// ============================================

export async function getSleepLogs(startDate?: string, endDate?: string): Promise<SleepLog[]> {
  const userId = getDemoUserId();

  let query = supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as SleepLog[];
}

export async function getSleepLogByDate(date: string): Promise<SleepLog | null> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as SleepLog | null;
}

export async function getSleepLogById(id: string) {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createSleepLog(log: {
  date: string;
  bedtime: string; // HH:mm format
  wake_time: string; // HH:mm format
  quality: '1' | '2' | '3' | '4' | '5';
  factors?: string[];
  notes?: string;
}): Promise<SleepLog> {
  const userId = getDemoUserId();

  const { data, error } = await supabase
    .from('sleep_logs')
    .insert({
      user_id: userId,
      date: log.date,
      bedtime: log.bedtime,
      wake_time: log.wake_time,
      quality: log.quality,
      factors: log.factors ?? [],
      notes: log.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SleepLog;
}

export async function updateSleepLog(
  id: string,
  updates: {
    bedtime?: string;
    wake_time?: string;
    quality?: '1' | '2' | '3' | '4' | '5';
    factors?: string[];
    notes?: string;
  }
): Promise<SleepLog> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SleepLog;
}

export async function upsertSleepLog(log: {
  date: string;
  bedtime: string;
  wake_time: string;
  quality: '1' | '2' | '3' | '4' | '5';
  factors?: string[];
  notes?: string;
}): Promise<SleepLog> {
  const userId = getDemoUserId();

  // Check if log exists for this date
  const existing = await getSleepLogByDate(log.date);

  if (existing) {
    return updateSleepLog(existing.id, log);
  } else {
    return createSleepLog(log);
  }
}

export async function deleteSleepLog(id: string) {
  const { error } = await supabase
    .from('sleep_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// SLEEP STATISTICS
// ============================================

export async function getSleepStats(days: number = 7) {
  const userId = getDemoUserId();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      averageDuration: 0,
      averageQuality: 0,
      totalLogs: 0,
      factorCounts: {},
    };
  }

  const totalDuration = data.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
  const totalQuality = data.reduce((sum, log) => sum + parseInt(log.quality), 0);

  const factorCounts: Record<string, number> = {};
  data.forEach(log => {
    (log.factors ?? []).forEach((factor: string) => {
      factorCounts[factor] = (factorCounts[factor] || 0) + 1;
    });
  });

  return {
    averageDuration: Math.round(totalDuration / data.length),
    averageQuality: totalQuality / data.length,
    totalLogs: data.length,
    factorCounts,
  };
}
