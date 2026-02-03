/**
 * Symptom Queries
 * Symptom logs and tracking
 */

import { supabase } from '../client';
import { requireAuthUserId } from '../constants';

// ============================================
// TYPES
// ============================================

export interface SymptomLog {
  id: string;
  user_id: string;
  symptom_id: string;
  severity: number;
  logged_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  symptom?: {
    id: string;
    name: string;
    category: string;
    is_system: boolean;
  } | null;
}

// ============================================
// SYMPTOM LOGS
// ============================================

export async function getSymptomLogs(startDate?: string, endDate?: string): Promise<SymptomLog[]> {
  const userId = await requireAuthUserId();

  let query = supabase
    .from('symptom_logs')
    .select(`
      *,
      symptom:symptoms (*)
    `)
    .eq('user_id', userId)
    .order('logged_at', { ascending: false });

  if (startDate) {
    query = query.gte('logged_at', `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte('logged_at', `${endDate}T23:59:59`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as SymptomLog[];
}

export async function getSymptomLogsByDate(date: string): Promise<SymptomLog[]> {
  const userId = await requireAuthUserId();

  const { data, error } = await supabase
    .from('symptom_logs')
    .select(`
      *,
      symptom:symptoms (*)
    `)
    .eq('user_id', userId)
    .gte('logged_at', `${date}T00:00:00`)
    .lte('logged_at', `${date}T23:59:59`)
    .order('logged_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SymptomLog[];
}

export async function getSymptomLogById(id: string): Promise<SymptomLog | null> {
  const { data, error } = await supabase
    .from('symptom_logs')
    .select(`
      *,
      symptom:symptoms (*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as SymptomLog | null;
}

export async function createSymptomLog(log: {
  symptom_id: string;
  severity: number;
  logged_at?: string;
  notes?: string;
}): Promise<SymptomLog> {
  const userId = await requireAuthUserId();

  const { data, error } = await supabase
    .from('symptom_logs')
    .insert({
      user_id: userId,
      symptom_id: log.symptom_id,
      severity: log.severity,
      logged_at: log.logged_at ?? new Date().toISOString(),
      notes: log.notes,
    })
    .select(`
      *,
      symptom:symptoms (*)
    `)
    .single();

  if (error) throw error;
  return data as SymptomLog;
}

export async function updateSymptomLog(
  id: string,
  updates: {
    severity?: number;
    logged_at?: string;
    notes?: string;
  }
): Promise<SymptomLog> {
  const { data, error } = await supabase
    .from('symptom_logs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(`
      *,
      symptom:symptoms (*)
    `)
    .single();

  if (error) throw error;
  return data as SymptomLog;
}

export async function deleteSymptomLog(id: string) {
  const { error } = await supabase
    .from('symptom_logs')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// CUSTOM SYMPTOMS
// ============================================

export async function createCustomSymptom(symptom: {
  name: string;
  category: string;
}) {
  const userId = await requireAuthUserId();

  const { data, error } = await supabase
    .from('symptoms')
    .insert({
      name: symptom.name,
      category: symptom.category,
      is_system: false,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// SYMPTOM STATISTICS
// ============================================

export async function getSymptomStats(days: number = 7) {
  const userId = await requireAuthUserId();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('symptom_logs')
    .select(`
      *,
      symptom:symptoms (*)
    `)
    .eq('user_id', userId)
    .gte('logged_at', startDate.toISOString())
    .order('logged_at', { ascending: false });

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      totalLogs: 0,
      averageSeverity: 0,
      symptomCounts: {},
      topSymptoms: [],
    };
  }

  const totalSeverity = data.reduce((sum: number, log: any) => sum + log.severity, 0);

  // Count by symptom
  const symptomCounts: Record<string, { count: number; name: string; totalSeverity: number }> = {};
  data.forEach((log: any) => {
    const symptomId = log.symptom_id;
    const symptomName = log.symptom?.name ?? 'Unknown';
    if (!symptomCounts[symptomId]) {
      symptomCounts[symptomId] = { count: 0, name: symptomName, totalSeverity: 0 };
    }
    symptomCounts[symptomId].count++;
    symptomCounts[symptomId].totalSeverity += log.severity;
  });

  const topSymptoms = Object.entries(symptomCounts)
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.count,
      avgSeverity: data.totalSeverity / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalLogs: data.length,
    averageSeverity: totalSeverity / data.length,
    symptomCounts,
    topSymptoms,
  };
}
