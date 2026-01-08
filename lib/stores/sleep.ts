import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SleepLog, SleepQuality, SleepFactor, SleepStats } from "@/types";

interface SleepState {
  logs: SleepLog[];

  // Actions
  addSleepLog: (log: Omit<SleepLog, "id">) => void;
  updateSleepLog: (id: string, updates: Partial<SleepLog>) => void;
  deleteSleepLog: (id: string) => void;
  getSleepByDate: (date: string) => SleepLog | undefined;
  getSleepByDateRange: (startDate: string, endDate: string) => SleepLog[];
  getSleepStats: (days: number) => SleepStats;
}

function calculateDuration(bedtime: string, wakeTime: string): number {
  const [bedHour, bedMin] = bedtime.split(":").map(Number);
  const [wakeHour, wakeMin] = wakeTime.split(":").map(Number);

  let bedMinutes = bedHour * 60 + bedMin;
  let wakeMinutes = wakeHour * 60 + wakeMin;

  // Handle overnight sleep
  if (wakeMinutes < bedMinutes) {
    wakeMinutes += 24 * 60;
  }

  return wakeMinutes - bedMinutes;
}

export const useSleepStore = create<SleepState>()(
  persist(
    (set, get) => ({
      logs: [],

      addSleepLog: (log) => {
        const newLog: SleepLog = {
          ...log,
          id: crypto.randomUUID(),
        };
        set((state) => ({ logs: [...state.logs, newLog] }));
      },

      updateSleepLog: (id, updates) => {
        set((state) => ({
          logs: state.logs.map((log) =>
            log.id === id ? { ...log, ...updates } : log
          ),
        }));
      },

      deleteSleepLog: (id) => {
        set((state) => ({
          logs: state.logs.filter((log) => log.id !== id),
        }));
      },

      getSleepByDate: (date) => {
        return get().logs.find((log) => log.date === date);
      },

      getSleepByDateRange: (startDate, endDate) => {
        return get().logs.filter(
          (log) => log.date >= startDate && log.date <= endDate
        );
      },

      getSleepStats: (days) => {
        const logs = get().logs;
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - days);

        const recentLogs = logs.filter((log) => {
          const logDate = new Date(log.date);
          return logDate >= startDate && logDate <= today;
        });

        if (recentLogs.length === 0) {
          return {
            averageDuration: 0,
            averageQuality: 0,
            consistency: 0,
            logs: [],
          };
        }

        const durations = recentLogs.map((log) =>
          calculateDuration(log.bedtime, log.wakeTime)
        );
        const qualities = recentLogs.map((log) => log.quality);

        const averageDuration =
          durations.reduce((a, b) => a + b, 0) / durations.length;
        const averageQuality =
          qualities.reduce((a, b) => a + b, 0) / qualities.length;

        // Calculate consistency (how close to target 8 hours)
        const targetDuration = 480; // 8 hours in minutes
        const deviations = durations.map((d) =>
          Math.abs(d - targetDuration) / targetDuration
        );
        const avgDeviation =
          deviations.reduce((a, b) => a + b, 0) / deviations.length;
        const consistency = Math.max(0, (1 - avgDeviation) * 100);

        return {
          averageDuration,
          averageQuality,
          consistency,
          logs: recentLogs,
        };
      },
    }),
    {
      name: "tibera-sleep",
    }
  )
);

export { calculateDuration };
