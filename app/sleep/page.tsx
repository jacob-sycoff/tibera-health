"use client";

import { useState, useEffect } from "react";
import { Moon, Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useSleepStore, calculateDuration } from "@/lib/stores/sleep";
import type { SleepQuality, SleepFactor } from "@/types";
import { cn } from "@/lib/utils/cn";

const QUALITY_LABELS: Record<SleepQuality, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Excellent",
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

export default function SleepTrackerPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [bedtime, setBedtime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [quality, setQuality] = useState<SleepQuality>(3);
  const [factors, setFactors] = useState<SleepFactor[]>([]);
  const [notes, setNotes] = useState("");

  const {
    logs,
    addSleepLog,
    updateSleepLog,
    deleteSleepLog,
    getSleepByDate,
    getSleepStats,
  } = useSleepStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const existingLog = getSleepByDate(selectedDate);
    if (existingLog) {
      setBedtime(existingLog.bedtime);
      setWakeTime(existingLog.wakeTime);
      setQuality(existingLog.quality);
      setFactors(existingLog.factors || []);
      setNotes(existingLog.notes || "");
      setIsEditing(true);
    } else {
      setBedtime("22:00");
      setWakeTime("06:00");
      setQuality(3);
      setFactors([]);
      setNotes("");
      setIsEditing(false);
    }
  }, [selectedDate, getSleepByDate]);

  if (!mounted) return <SleepSkeleton />;

  const existingLog = getSleepByDate(selectedDate);
  const stats = getSleepStats(7);
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
    const logData = {
      date: selectedDate,
      bedtime,
      wakeTime,
      quality,
      factors,
      notes: notes || undefined,
    };

    if (existingLog) {
      updateSleepLog(existingLog.id, logData);
    } else {
      addSleepLog(logData);
    }
    setIsEditing(true);
  };

  const handleDelete = () => {
    if (existingLog) {
      deleteSleepLog(existingLog.id);
      setIsEditing(false);
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
            <p className="text-2xl font-bold text-sleep-600">
              {(stats.averageDuration / 60).toFixed(1)}h
            </p>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">
              {stats.averageQuality.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Avg Quality</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">
              {Math.round(stats.consistency)}%
            </p>
            <p className="text-xs text-muted-foreground">Consistency</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
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
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
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
              <label className="text-sm font-medium text-muted-foreground">
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
              <label className="text-sm font-medium text-muted-foreground">
                Sleep Quality
              </label>
              <Badge
                variant={quality >= 4 ? "success" : quality >= 3 ? "default" : "warning"}
              >
                {QUALITY_LABELS[quality]}
              </Badge>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={quality}
              onValueChange={(value) => setQuality(value as SleepQuality)}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
          </div>

          {/* Sleep Factors */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
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
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {factor.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did you feel when you woke up?"
              className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Save Button */}
          <Button className="w-full" onClick={handleSave}>
            {existingLog ? "Update Sleep Log" : "Save Sleep Log"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Recent Sleep</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No sleep logs this week
            </p>
          ) : (
            <ul className="space-y-2">
              {stats.logs
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 7)
                .map((log) => {
                  const dur = calculateDuration(log.bedtime, log.wakeTime);
                  return (
                    <li
                      key={log.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="font-medium">
                          {new Date(log.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.bedtime} - {log.wakeTime}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {Math.floor(dur / 60)}h {dur % 60}m
                        </p>
                        <Badge
                          variant={
                            log.quality >= 4
                              ? "success"
                              : log.quality >= 3
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
      <div className="h-10 bg-muted rounded-lg animate-pulse w-48" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-96 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
