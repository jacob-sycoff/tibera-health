"use client";

import { useState, useMemo } from "react";
import {
  Activity,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  BarChart3,
  AlertCircle,
  Edit2,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useSymptomLogsByDate,
  useSymptomLogs,
  useCreateSymptomLog,
  useUpdateSymptomLog,
  useDeleteSymptomLog,
  useCreateCustomSymptom,
  useSymptomsList,
} from "@/lib/hooks";
import type { SymptomSeverity, SymptomCategory } from "@/types";
import { cn } from "@/lib/utils/cn";

// Database types
interface DatabaseSymptom {
  id: string;
  name: string;
  category: string;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
}

interface DatabaseSymptomLog {
  id: string;
  user_id: string;
  symptom_id: string;
  severity: number;
  logged_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  symptom: DatabaseSymptom | null;
}

const SEVERITY_COLORS: Record<number, string> = {
  1: "bg-green-500",
  2: "bg-green-400",
  3: "bg-yellow-400",
  4: "bg-yellow-500",
  5: "bg-orange-400",
  6: "bg-orange-500",
  7: "bg-red-400",
  8: "bg-red-500",
  9: "bg-red-600",
  10: "bg-red-700",
};

const SEVERITY_TEXT_COLORS: Record<number, string> = {
  1: "text-green-600",
  2: "text-green-500",
  3: "text-yellow-500",
  4: "text-yellow-600",
  5: "text-orange-500",
  6: "text-orange-600",
  7: "text-red-400",
  8: "text-red-500",
  9: "text-red-600",
  10: "text-red-700",
};

const CATEGORIES: SymptomCategory[] = [
  "digestive",
  "energy",
  "mood",
  "pain",
  "skin",
  "respiratory",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  digestive: "Digestive",
  energy: "Energy",
  mood: "Mood",
  pain: "Pain",
  skin: "Skin",
  respiratory: "Respiratory",
  other: "Other",
};

const TIME_OF_DAY = [
  { value: "morning", label: "Morning", hours: "6am-12pm" },
  { value: "afternoon", label: "Afternoon", hours: "12pm-6pm" },
  { value: "evening", label: "Evening", hours: "6pm-12am" },
  { value: "night", label: "Night", hours: "12am-6am" },
];

function getTimeOfDay(date: Date): string {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "night";
}

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split("T")[0]);
  }
  return days;
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category;
}

export default function SymptomsPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState<DatabaseSymptom | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>(5);
  const [notes, setNotes] = useState("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<SymptomCategory | "all">("all");
  const [editingLog, setEditingLog] = useState<{ id: string } | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customSymptomName, setCustomSymptomName] = useState("");
  const [customSymptomCategory, setCustomSymptomCategory] = useState<SymptomCategory>("other");

  // Supabase hooks
  const { data: todaysLogs = [], isLoading: logsLoading } = useSymptomLogsByDate(selectedDate);
  const { data: allSymptoms = [], isLoading: symptomsLoading } = useSymptomsList();

  // Get logs for last 7 days for stats
  const last7Days = getLast7Days();
  const { data: weekLogs = [] } = useSymptomLogs(last7Days[0], last7Days[6]);

  // Get all logs for history
  const { data: allLogs = [], isLoading: historyLoading } = useSymptomLogs();

  // Mutations
  const createLog = useCreateSymptomLog();
  const updateLog = useUpdateSymptomLog();
  const deleteLog = useDeleteSymptomLog();
  const createCustomSymptom = useCreateCustomSymptom();

  const isLoading = logsLoading || symptomsLoading;

  // Calculate statistics
  const stats = useMemo(() => {
    if (weekLogs.length === 0) {
      return {
        totalThisWeek: 0,
        topSymptoms: [],
        timePatterns: { morning: 0, afternoon: 0, evening: 0, night: 0 },
        dailyCounts: last7Days.map(date => ({ date, count: 0, avgSeverity: 0 })),
        trend: 0,
        avgSeverity: 0,
      };
    }

    // Most frequent symptoms
    const symptomCounts: Record<string, { count: number; name: string; totalSeverity: number }> = {};
    weekLogs.forEach((log) => {
      const symptomId = log.symptom_id;
      const symptomName = log.symptom?.name ?? "Unknown";
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

    // Time of day patterns
    const timePatterns: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    weekLogs.forEach((log) => {
      const tod = getTimeOfDay(new Date(log.logged_at));
      timePatterns[tod]++;
    });

    // Daily counts for trend
    const dailyCounts = last7Days.map((date) => {
      const dayLogs = weekLogs.filter((log) =>
        log.logged_at.startsWith(date)
      );
      return {
        date,
        count: dayLogs.length,
        avgSeverity:
          dayLogs.length > 0
            ? dayLogs.reduce((sum: number, l) => sum + l.severity, 0) / dayLogs.length
            : 0,
      };
    });

    // Trend calculation
    const firstHalf = dailyCounts.slice(0, 3).reduce((sum, d) => sum + d.count, 0);
    const secondHalf = dailyCounts.slice(4).reduce((sum, d) => sum + d.count, 0);
    const trend = secondHalf - firstHalf;

    return {
      totalThisWeek: weekLogs.length,
      topSymptoms,
      timePatterns,
      dailyCounts,
      trend,
      avgSeverity:
        weekLogs.length > 0
          ? weekLogs.reduce((sum: number, l) => sum + l.severity, 0) / weekLogs.length
          : 0,
    };
  }, [weekLogs, last7Days]);

  if (isLoading) return <SymptomsSkeleton />;

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const handleSelectSymptom = (symptom: DatabaseSymptom) => {
    setSelectedSymptom(symptom);
    setSeverity(5);
    setNotes("");
    setSelectedTime("");
  };

  const handleLogSymptom = () => {
    if (!selectedSymptom) return;

    const logTime = selectedTime
      ? `${selectedDate}T${selectedTime}:00`
      : new Date().toISOString();

    if (editingLog) {
      updateLog.mutate({
        id: editingLog.id,
        updates: {
          severity,
          logged_at: logTime,
          notes: notes || undefined,
        },
      });
      setEditingLog(null);
    } else {
      createLog.mutate({
        symptom_id: selectedSymptom.id,
        severity,
        logged_at: logTime,
        notes: notes || undefined,
      });
    }

    setSelectedSymptom(null);
    setShowAddForm(false);
  };

  const handleEditLog = (log: { id: string; symptom_id: string; severity: number; notes: string | null; logged_at: string }) => {
    const symptom = allSymptoms.find((s: DatabaseSymptom) => s.id === log.symptom_id);
    if (symptom) {
      setSelectedSymptom(symptom);
      setSeverity(log.severity as SymptomSeverity);
      setNotes(log.notes || "");
      setSelectedTime(new Date(log.logged_at).toTimeString().slice(0, 5));
      setEditingLog({ id: log.id });
      setShowAddForm(true);
    }
  };

  const handleAddCustomSymptom = () => {
    if (!customSymptomName.trim()) return;
    createCustomSymptom.mutate({
      name: customSymptomName.trim(),
      category: customSymptomCategory,
    });
    setCustomSymptomName("");
    setShowCustomForm(false);
  };

  const filteredSymptoms =
    activeCategory === "all"
      ? allSymptoms
      : allSymptoms.filter((s: DatabaseSymptom) => s.category === activeCategory);

  const groupedSymptoms = CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredSymptoms.filter((s: DatabaseSymptom) => s.category === category);
    return acc;
  }, {} as Record<SymptomCategory, DatabaseSymptom[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <Activity className="w-5 h-5 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold">Symptoms</h1>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Log Symptom
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
          <TabsTrigger value="insights" className="flex-1">Insights</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4 mt-4">
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

          {/* Quick Stats for Today */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{todaysLogs.length}</p>
                <p className="text-xs text-gray-500">Logged</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">
                  {todaysLogs.length > 0
                    ? (todaysLogs.reduce((s: number, l) => s + l.severity, 0) / todaysLogs.length).toFixed(1)
                    : "-"}
                </p>
                <p className="text-xs text-gray-500">Avg Severity</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">
                  {todaysLogs.length > 0 ? Math.max(...todaysLogs.map((l) => l.severity)) : "-"}
                </p>
                <p className="text-xs text-gray-500">Peak</p>
              </CardContent>
            </Card>
          </div>

          {/* Today's Symptoms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Logged Symptoms</CardTitle>
            </CardHeader>
            <CardContent>
              {todaysLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto text-gray-500 mb-3" />
                  <p className="text-gray-500 mb-4">No symptoms logged for this day</p>
                  <Button variant="outline" onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Your First Symptom
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {[...todaysLogs]
                    .sort((a, b) =>
                      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
                    )
                    .map((log) => (
                      <li
                        key={log.id}
                        className="flex items-start justify-between py-3 border-b border-gray-200 last:border-0"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0",
                              SEVERITY_COLORS[log.severity]
                            )}
                          >
                            {log.severity}
                          </div>
                          <div>
                            <p className="font-medium">{log.symptom?.name ?? "Unknown"}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(log.logged_at).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                              <span className="capitalize">
                                ({getTimeOfDay(new Date(log.logged_at))})
                              </span>
                            </div>
                            {log.notes && (
                              <p className="text-sm text-gray-500 mt-1 italic">
                                "{log.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-900"
                            onClick={() => handleEditLog(log)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-destructive"
                            onClick={() => deleteLog.mutate(log.id)}
                            disabled={deleteLog.isPending}
                          >
                            {deleteLog.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {/* Weekly Overview */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">This Week</CardTitle>
                {stats && stats.trend !== 0 && (
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm",
                      stats.trend > 0 ? "text-red-500" : "text-green-500"
                    )}
                  >
                    {stats.trend > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Math.abs(stats.trend)} {stats.trend > 0 ? "more" : "fewer"}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-3xl font-bold">{stats?.totalThisWeek || 0}</p>
                  <p className="text-sm text-gray-500">Total Symptoms</p>
                </div>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className={cn("text-3xl font-bold", stats && SEVERITY_TEXT_COLORS[Math.round(stats.avgSeverity)] )}>
                    {stats?.avgSeverity.toFixed(1) || "-"}
                  </p>
                  <p className="text-sm text-gray-500">Avg Severity</p>
                </div>
              </div>

              {/* Daily Bar Chart */}
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Daily Overview</p>
                <div className="flex items-end gap-1 h-24">
                  {stats?.dailyCounts.map((day) => {
                    const maxCount = Math.max(...(stats.dailyCounts.map((d) => d.count) || [1]));
                    const height = day.count > 0 ? (day.count / maxCount) * 100 : 4;
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "w-full rounded-t transition-all",
                            day.count > 0 ? "bg-orange-400" : "bg-gray-100"
                          )}
                          style={{ height: `${height}%` }}
                          title={`${day.count} symptoms`}
                        />
                        <span className="text-xs text-gray-500">
                          {new Date(day.date).toLocaleDateString("en-US", { weekday: "narrow" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Symptoms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Most Frequent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats && stats.topSymptoms.length > 0 ? (
                <ul className="space-y-3">
                  {stats.topSymptoms.map((symptom, i) => (
                    <li key={symptom.id} className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-500 w-6">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{symptom.name}</p>
                        <p className="text-xs text-gray-500">
                          {symptom.count}x this week • Avg severity:{" "}
                          <span className={SEVERITY_TEXT_COLORS[Math.round(symptom.avgSeverity)]}>
                            {symptom.avgSeverity.toFixed(1)}
                          </span>
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                          SEVERITY_COLORS[Math.round(symptom.avgSeverity)]
                        )}
                      >
                        {symptom.count}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No symptoms logged this week
                </p>
              )}
            </CardContent>
          </Card>

          {/* Time Patterns */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Time Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {TIME_OF_DAY.map((time) => {
                  const count = stats?.timePatterns[time.value] || 0;
                  const total = stats?.totalThisWeek || 1;
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={time.value} className="text-center p-3 bg-gray-100 rounded-lg">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs font-medium">{time.label}</p>
                      <p className="text-xs text-gray-500">{time.hours}</p>
                      <div className="mt-2 h-1 bg-white rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {stats && stats.topSymptoms.some((s) => s.avgSeverity >= 7) && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">High Severity Alert</p>
                    <p className="text-sm text-red-700">
                      Some symptoms have been consistently severe. Consider consulting a healthcare
                      provider.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                All Logged Symptoms
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : allLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No symptoms logged yet
                </p>
              ) : (
                <ul className="space-y-2 max-h-[60vh] overflow-auto">
                  {[...allLogs]
                    .sort((a, b) =>
                      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
                    )
                    .map((log) => (
                      <li
                        key={log.id}
                        className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                              SEVERITY_COLORS[log.severity]
                            )}
                          >
                            {log.severity}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{log.symptom?.name ?? "Unknown"}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(log.logged_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              at{" "}
                              {new Date(log.logged_at).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-destructive"
                          onClick={() => deleteLog.mutate(log.id)}
                          disabled={deleteLog.isPending}
                        >
                          {deleteLog.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Symptom Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[85vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingLog ? "Edit Symptom" : "Log Symptom"}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedSymptom(null);
                    setEditingLog(null);
                    setShowCustomForm(false);
                  }}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedSymptom ? (
                <>
                  {/* Category Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                    <button
                      onClick={() => setActiveCategory("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                        activeCategory === "all"
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                          activeCategory === cat
                            ? "bg-orange-500 text-white"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {getCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>

                  {/* Custom Symptom Form */}
                  {showCustomForm ? (
                    <div className="space-y-3 p-4 bg-gray-100 rounded-lg">
                      <p className="font-medium">Add Custom Symptom</p>
                      <Input
                        placeholder="Symptom name"
                        value={customSymptomName}
                        onChange={(e) => setCustomSymptomName(e.target.value)}
                      />
                      <select
                        value={customSymptomCategory}
                        onChange={(e) => setCustomSymptomCategory(e.target.value as SymptomCategory)}
                        className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {getCategoryLabel(cat)}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowCustomForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={handleAddCustomSymptom}
                          disabled={!customSymptomName.trim() || createCustomSymptom.isPending}
                        >
                          {createCustomSymptom.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : null}
                          Add
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowCustomForm(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Custom Symptom
                    </Button>
                  )}

                  {/* Symptom Selection */}
                  <div className="space-y-4">
                    {symptomsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : activeCategory === "all" ? (
                      CATEGORIES.map((category) => {
                        const symptoms = groupedSymptoms[category];
                        if (symptoms.length === 0) return null;
                        return (
                          <div key={category}>
                            <h3 className="text-sm font-medium text-gray-500 mb-2">
                              {getCategoryLabel(category)}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {symptoms.map((symptom: DatabaseSymptom) => (
                                <button
                                  key={symptom.id}
                                  onClick={() => handleSelectSymptom(symptom)}
                                  className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium hover:bg-orange-100 hover:text-orange-700 transition-colors"
                                >
                                  {symptom.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredSymptoms.map((symptom: DatabaseSymptom) => (
                          <button
                            key={symptom.id}
                            onClick={() => handleSelectSymptom(symptom)}
                            className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium hover:bg-orange-100 hover:text-orange-700 transition-colors"
                          >
                            {symptom.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected Symptom */}
                  <div className="text-center py-4 bg-orange-50 rounded-lg">
                    <p className="text-lg font-bold text-orange-800">{selectedSymptom.name}</p>
                    <Badge variant="secondary" className="mt-1">
                      {getCategoryLabel(selectedSymptom.category)}
                    </Badge>
                  </div>

                  {/* Severity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium">Severity</label>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                            SEVERITY_COLORS[severity]
                          )}
                        >
                          {severity}
                        </span>
                      </div>
                    </div>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={severity}
                      onValueChange={(value) => setSeverity(value as SymptomSeverity)}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>1 - Barely noticeable</span>
                      <span>10 - Unbearable</span>
                    </div>
                  </div>

                  {/* Time Selection */}
                  <div>
                    <label className="text-sm font-medium">Time (optional)</label>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave blank to use current time
                    </p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium">Notes (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="What were you doing? What might have triggered it?"
                      className="mt-1 w-full min-h-[80px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setSelectedSymptom(null);
                        setEditingLog(null);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={handleLogSymptom}
                      disabled={createLog.isPending || updateLog.isPending}
                    >
                      {(createLog.isPending || updateLog.isPending) ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {editingLog ? "Update" : "Log Symptom"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SymptomsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-10 w-32 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}
