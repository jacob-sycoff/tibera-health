"use client";

import { useState, useEffect, useMemo } from "react";
import { Moon, ChevronLeft, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  useSleepLogByDate,
  useSleepLogs,
  useUpsertSleepLog,
  useDeleteSleepLog,
  useSleepStats,
} from "@/lib/hooks";
import type { SleepQuality, SleepFactor } from "@/types";
import { cn } from "@/lib/utils/cn";

// Database types
interface DatabaseSleepLog {
  id: string;
  user_id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  quality: '1' | '2' | '3' | '4' | '5';
  factors: string[] | null;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

const QUALITY_LABELS: Record<string, string> = {
  "1": "Very Poor",
  "2": "Poor",
  "3": "Fair",
  "4": "Good",
  "5": "Excellent",
};

const SLEEP_FACTORS: { value: SleepFactor; label: string }[] = [
  { value: "caffeine", label: "Caffeine" },
  { value: "alcohol", label: "Alcohol" },
  { value: "exercise", label: "Exercise" },
  { value: "stress", label: "Stress" },
  { value: "screen_time", label: "Screen Time" },
  { value: "late_meal", label: "Late Meal" },
  { value: "medication", label: "Medication" },
];

// Helper function to calculate duration from bedtime/waketime
function calculateDuration(bedtime: string, wakeTime: string): number {
  const [bedHours, bedMins] = bedtime.split(":").map(Number);
  const [wakeHours, wakeMins] = wakeTime.split(":").map(Number);

  let bedMinutes = bedHours * 60 + bedMins;
  let wakeMinutes = wakeHours * 60 + wakeMins;

  // If wake time is earlier than bedtime, add 24 hours to wake time
  if (wakeMinutes < bedMinutes) {
    wakeMinutes += 24 * 60;
  }

  return wakeMinutes - bedMinutes;
}

export default function SleepTrackerPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Form state
  const [bedtime, setBedtime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [quality, setQuality] = useState<SleepQuality>(3);
  const [factors, setFactors] = useState<SleepFactor[]>([]);
  const [notes, setNotes] = useState("");

  // Supabase hooks
  const { data: existingLog, isLoading: logLoading } = useSleepLogByDate(selectedDate);
  const { data: statsData, isLoading: statsLoading } = useSleepStats(7);
  const { data: recentLogs = [], isLoading: recentLogsLoading } = useSleepLogs();

  // Mutations
  const upsertLog = useUpsertSleepLog();
  const deleteLog = useDeleteSleepLog();

  // Calculate stats with consistency
  const stats = useMemo(() => {
    if (!statsData) {
      return {
        averageDuration: 0,
        averageQuality: 0,
        consistency: 0,
        logs: [],
      };
    }

    // Calculate consistency as percentage of days with logs
    const consistency = (statsData.totalLogs / 7) * 100;

    return {
      averageDuration: statsData.averageDuration,
      averageQuality: statsData.averageQuality,
      consistency,
      logs: recentLogs.slice(0, 7),
    };
  }, [statsData, recentLogs]);

  // Update form when selected date changes or log is loaded
  useEffect(() => {
    if (existingLog) {
      setBedtime(existingLog.bedtime);
      setWakeTime(existingLog.wake_time);
      setQuality(parseInt(existingLog.quality) as SleepQuality);
      setFactors((existingLog.factors || []) as SleepFactor[]);
      setNotes(existingLog.notes || "");
    } else {
      setBedtime("22:00");
      setWakeTime("06:00");
      setQuality(3);
      setFactors([]);
      setNotes("");
    }
  }, [existingLog, selectedDate]);

  const isLoading = logLoading || statsLoading;

  if (isLoading && !existingLog) return <SleepSkeleton />;

  const duration = calculateDuration(bedtime, wakeTime);
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const toggleFactor = (factor: SleepFactor) => {
    setFactors((prev) =>
      prev.includes(factor)
        ? prev.filter((f) => f !== factor)
        : [...prev, factor]
    );
  };

  const handleSave = () => {
    upsertLog.mutate({
      date: selectedDate,
      bedtime,
      wake_time: wakeTime,
      quality: quality.toString() as '1' | '2' | '3' | '4' | '5',
      factors,
      notes: notes || undefined,
    });
  };

  const handleDelete = () => {
    if (existingLog) {
      deleteLog.mutate(existingLog.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sleep-100 flex items-center justify-center">
          <Moon className="w-5 h-5 text-sleep-600" />
        </div>
        <h1 className="text-2xl font-bold">Sleep Tracker</h1>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            {statsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            ) : (
              <>
                <p className="text-2xl font-bold text-sleep-600">
                  {(stats.averageDuration / 60).toFixed(1)}h
                </p>
                <p className="text-xs text-gray-500">Avg Duration</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            {statsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            ) : (
              <>
                <p className="text-2xl font-bold">
                  {stats.averageQuality.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">Avg Quality</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            {statsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            ) : (
              <>
                <p className="text-2xl font-bold">
                  {Math.round(stats.consistency)}%
                </p>
                <p className="text-xs text-gray-500">Consistency</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium">
          {isToday
            ? "Today"
            : new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateDate(1)}
          disabled={isToday}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Sleep Log Form */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {existingLog ? "Edit Sleep Log" : "Log Sleep"}
            </CardTitle>
            {existingLog && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={handleDelete}
                disabled={deleteLog.isPending}
              >
                {deleteLog.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Delete
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {logLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Bedtime
                  </label>
                  <Input
                    type="time"
                    value={bedtime}
                    onChange={(e) => setBedtime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Wake Time
                  </label>
                  <Input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Duration Display */}
              <div className="text-center py-4 bg-sleep-50 rounded-lg">
                <p className="text-3xl font-bold text-sleep-700">
                  {hours}h {minutes}m
                </p>
                <p className="text-sm text-sleep-600">Total Sleep</p>
              </div>

              {/* Quality Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-500">
                    Sleep Quality
                  </label>
                  <Badge
                    variant={quality >= 4 ? "success" : quality >= 3 ? "default" : "warning"}
                  >
                    {QUALITY_LABELS[quality.toString()]}
                  </Badge>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={quality}
                  onValueChange={(value) => setQuality(value as SleepQuality)}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Poor</span>
                  <span>Excellent</span>
                </div>
              </div>

              {/* Sleep Factors */}
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">
                  Factors (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {SLEEP_FACTORS.map((factor) => (
                    <button
                      key={factor.value}
                      onClick={() => toggleFactor(factor.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        factors.includes(factor.value)
                          ? "bg-sleep-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-100/80"
                      )}
                    >
                      {factor.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did you feel when you woke up?"
                  className="mt-1 w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              {/* Save Button */}
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={upsertLog.isPending}
              >
                {upsertLog.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {existingLog ? "Update Sleep Log" : "Save Sleep Log"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Recent Sleep</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : recentLogs.length === 0 ? (
            <p className="text-center text-gray-500 py-4">
              No sleep logs this week
            </p>
          ) : (
            <ul className="space-y-2">
              {[...recentLogs]
                .sort((a: DatabaseSleepLog, b: DatabaseSleepLog) => b.date.localeCompare(a.date))
                .slice(0, 7)
                .map((log: DatabaseSleepLog) => {
                  const dur = log.duration_minutes ?? calculateDuration(log.bedtime, log.wake_time);
                  const qualityNum = parseInt(log.quality);
                  return (
                    <li
                      key={log.id}
                      className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(log.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {log.bedtime} - {log.wake_time}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {Math.floor(dur / 60)}h {dur % 60}m
                        </p>
                        <Badge
                          variant={
                            qualityNum >= 4
                              ? "success"
                              : qualityNum >= 3
                              ? "default"
                              : "warning"
                          }
                          className="text-xs"
                        >
                          {QUALITY_LABELS[log.quality]}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SleepSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-96 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}
