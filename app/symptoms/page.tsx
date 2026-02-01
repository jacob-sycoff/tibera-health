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
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/modal";
import {
  useSymptomLogsByDate,
  useSymptomLogs,
  useCreateSymptomLog,
  useUpdateSymptomLog,
  useDeleteSymptomLog,
  useCreateCustomSymptom,
  useSymptomsList,
  useSymptomCategories,
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

export default function SymptomsPage() {
  const todayISO = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(
    todayISO
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
  const [symptomQuery, setSymptomQuery] = useState("");

  // Supabase hooks
  const { data: todaysLogs = [], isLoading: logsLoading } = useSymptomLogsByDate(selectedDate);
  const { data: allSymptoms = [], isLoading: symptomsLoading } = useSymptomsList();
  const { data: categories = [], isLoading: categoriesLoading } = useSymptomCategories();

  // Helper to get category label from fetched categories
  const getCategoryLabel = (slug: string): string => {
    const category = categories.find(c => c.slug === slug);
    return category?.label || slug.charAt(0).toUpperCase() + slug.slice(1);
  };

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

  const isLoading = logsLoading || symptomsLoading || categoriesLoading;

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

  const isToday = selectedDate === todayISO;

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

  const filteredSymptoms = allSymptoms
    .filter((s: DatabaseSymptom) =>
      activeCategory === "all" ? true : s.category === activeCategory
    )
    .filter((s: DatabaseSymptom) =>
      symptomQuery.trim().length === 0
        ? true
        : s.name.toLowerCase().includes(symptomQuery.trim().toLowerCase())
    );

  // Group symptoms by category using fetched categories
  const groupedSymptoms = categories.reduce((acc, category) => {
    acc[category.slug] = filteredSymptoms.filter((s: DatabaseSymptom) => s.category === category.slug);
    return acc;
  }, {} as Record<string, DatabaseSymptom[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(900px_circle_at_10%_-15%,rgba(245,158,11,0.18),transparent_55%),radial-gradient(800px_circle_at_95%_0%,rgba(2,6,23,0.08),transparent_55%)]"
        />
        <div className="relative p-6">
          <PageHeader
            title="Symptoms"
            description="Log what you feel, notice patterns, and reduce guesswork over time."
            action={
              <Button
                variant="warning"
                shape="pill"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Symptom
              </Button>
            }
          />
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="today">
        <TabsList className="w-full rounded-full border border-black/10 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/60">
          <TabsTrigger value="today" className="flex-1">Today</TabsTrigger>
          <TabsTrigger value="insights" className="flex-1">Insights</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        {/* Today Tab */}
        <TabsContent value="today" className="space-y-4 mt-4">
          {/* Date Navigation */}
          <Card className="relative overflow-hidden p-3">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(700px_circle_at_15%_0%,rgba(245,158,11,0.14),transparent_60%),linear-gradient(to_bottom,rgba(255,255,255,0.35),rgba(255,255,255,0))] dark:bg-[radial-gradient(700px_circle_at_15%_0%,rgba(245,158,11,0.10),transparent_60%),linear-gradient(to_bottom,rgba(2,6,23,0.10),rgba(2,6,23,0))]"
            />
            <div className="relative flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                shape="pill"
                onClick={() => navigateDate(-1)}
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="flex-1 text-center leading-tight">
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
                  Log date
                </div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {isToday
                    ? "Today"
                    : new Date(selectedDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                </div>
              </div>

              <Button
                variant="outline"
                size="icon"
                shape="pill"
                onClick={() => navigateDate(1)}
                disabled={isToday}
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>

              {!isToday && (
                <Button
                  variant="ghost"
                  size="sm"
                  shape="pill"
                  onClick={() => setSelectedDate(todayISO)}
                >
                  Today
                </Button>
              )}
            </div>
          </Card>

          {/* Quick Stats for Today */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Entries"
              value={todaysLogs.length}
              icon={<Activity className="w-5 h-5" />}
            />
            <MetricCard
              label="Avg Severity"
              value={todaysLogs.length > 0
                ? (todaysLogs.reduce((s: number, l) => s + l.severity, 0) / todaysLogs.length).toFixed(1)
                : "-"}
              icon={<BarChart3 className="w-5 h-5" />}
            />
            <MetricCard
              label="Peak"
              value={todaysLogs.length > 0 ? Math.max(...todaysLogs.map((l) => l.severity)) : "-"}
              icon={<AlertCircle className="w-5 h-5" />}
            />
          </div>

          {/* Today's Symptoms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Logged Symptoms</CardTitle>
            </CardHeader>
            <CardContent>
              {todaysLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto text-slate-500 dark:text-slate-400 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 mb-4">No symptoms logged for this day</p>
                  <Button variant="outline" shape="pill" onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Log Your First Symptom
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {[...todaysLogs]
                    .sort((a, b) =>
                      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
                    )
                    .map((log) => (
                      <li
                        key={log.id}
                        className={cn(
                          "group relative overflow-hidden rounded-[22px] border p-3 transition-all",
                          "border-black/10 bg-white/60 hover:bg-white/80",
                          "dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "w-11 h-11 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-[0_12px_28px_-18px_rgba(2,6,23,0.65)]",
                              SEVERITY_COLORS[log.severity]
                            )}
                          >
                            {log.severity}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {log.symptom?.name ?? "Unknown"}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="glass" className="gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(log.logged_at).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </Badge>
                              <Badge variant="glass" className="capitalize">
                                {getTimeOfDay(new Date(log.logged_at))}
                              </Badge>
                              {log.symptom?.category && (
                                <Badge variant="secondary">
                                  {getCategoryLabel(log.symptom.category)}
                                </Badge>
                              )}
                            </div>
                            {log.notes && (
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                {log.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-gray-900"
                            onClick={() => handleEditLog(log)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-destructive"
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
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Entries"
                  value={stats?.totalThisWeek || 0}
                  icon={<Activity className="w-5 h-5" />}
                  sparklineData={stats?.dailyCounts.map((d) => d.count) || []}
                  trend={
                    stats
                      ? stats.trend < 0
                        ? "up"
                        : stats.trend > 0
                        ? "down"
                        : "neutral"
                      : undefined
                  }
                  trendValue={
                    stats && stats.trend !== 0 ? `${Math.abs(stats.trend)}` : undefined
                  }
                />
                <MetricCard
                  label="Avg Severity"
                  value={stats?.avgSeverity.toFixed(1) || "-"}
                  icon={<BarChart3 className="w-5 h-5" />}
                  animated={false}
                />
              </div>

              {/* Daily Bar Chart */}
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Daily Overview</p>
                <div className="flex items-end gap-1.5 h-28">
                  {stats?.dailyCounts.map((day) => {
                    const maxCount = Math.max(...(stats.dailyCounts.map((d) => d.count) || [1]));
                    const height = day.count > 0 ? (day.count / maxCount) * 100 : 4;
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "w-full rounded-[10px] transition-all",
                            day.count > 0
                              ? "bg-gradient-to-t from-warning-600 to-warning-400 shadow-[0_12px_24px_-18px_rgba(245,158,11,0.8)]"
                              : "bg-slate-100 dark:bg-slate-800"
                          )}
                          style={{ height: `${height}%` }}
                          title={`${day.count} symptoms`}
                        />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
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
                      <span className="text-lg font-bold text-slate-500 dark:text-slate-400 w-6">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{symptom.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
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
                <p className="text-center text-slate-500 dark:text-slate-400 py-4">
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
                    <div
                      key={time.value}
                      className="text-center p-3 rounded-[18px] border border-black/5 bg-white/60 dark:border-white/10 dark:bg-slate-900/40"
                    >
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs font-medium">{time.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{time.hours}</p>
                      <div className="mt-2 h-1 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-warning-500 to-warning-600 transition-all"
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
            <Card className="border-red-500/20 bg-red-50/70 dark:bg-red-950/30 dark:border-red-500/20">
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
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                </div>
              ) : allLogs.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                  No symptoms logged yet
                </p>
              ) : (
                <ul className="space-y-2 max-h-[60vh] overflow-auto pr-2">
                  {[...allLogs]
                    .sort((a, b) =>
                      new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
                    )
                    .map((log) => (
                      <li
                        key={log.id}
                        className={cn(
                          "group flex items-center justify-between gap-3 rounded-[20px] border p-3 transition-all",
                          "border-black/10 bg-white/60 hover:bg-white/80",
                          "dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-2xl flex items-center justify-center text-white text-xs font-bold shadow-[0_12px_28px_-18px_rgba(2,6,23,0.65)]",
                              SEVERITY_COLORS[log.severity]
                            )}
                          >
                            {log.severity}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{log.symptom?.name ?? "Unknown"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                          className="h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-destructive"
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
      <Modal
        open={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setSelectedSymptom(null);
          setEditingLog(null);
          setShowCustomForm(false);
          setSymptomQuery("");
        }}
        position="responsive"
        size="lg"
        className="max-w-lg mb-[calc(12px+env(safe-area-inset-bottom))]"
      >
        <ModalHeader>
          <ModalTitle>{editingLog ? "Edit symptom" : "Log symptom"}</ModalTitle>
          <ModalDescription>
            Choose a symptom, set severity, and optionally add time + notes.
          </ModalDescription>
        </ModalHeader>
        <ModalContent className="space-y-6">
          {!selectedSymptom ? (
            <>
              {/* Category Filter */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <Button
                  type="button"
                  size="sm"
                  shape="pill"
                  variant={activeCategory === "all" ? "warning" : "secondary"}
                  onClick={() => setActiveCategory("all")}
                >
                  All
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.slug}
                    type="button"
                    size="sm"
                    shape="pill"
                    variant={activeCategory === cat.slug ? "warning" : "secondary"}
                    onClick={() => setActiveCategory(cat.slug as SymptomCategory)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search symptoms…"
                  value={symptomQuery}
                  onChange={(e) => setSymptomQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Custom Symptom Form */}
              {showCustomForm ? (
                <div className="space-y-3 p-4 rounded-[22px] border border-black/10 bg-white/60 dark:border-white/10 dark:bg-slate-900/40">
                  <p className="font-medium text-slate-900 dark:text-slate-100">Add custom symptom</p>
                  <Input
                    placeholder="Symptom name"
                    value={customSymptomName}
                    onChange={(e) => setCustomSymptomName(e.target.value)}
                  />
                  <select
                    value={customSymptomCategory}
                    onChange={(e) => setCustomSymptomCategory(e.target.value as SymptomCategory)}
                    className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 text-sm"
                  >
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowCustomForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="warning"
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
                  type="button"
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
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
                  </div>
                ) : activeCategory === "all" ? (
                  categories.map((category) => {
                    const symptoms = groupedSymptoms[category.slug] || [];
                    if (symptoms.length === 0) return null;
                    return (
                      <div key={category.slug}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400">
                            {category.label}
                          </h3>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {symptoms.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {symptoms.map((symptom: DatabaseSymptom) => (
                            <button
                              key={symptom.id}
                              type="button"
                              onClick={() => handleSelectSymptom(symptom)}
                              className={cn(
                                "group text-left rounded-[18px] border p-3 transition-all",
                                "border-black/10 bg-white/60 hover:bg-white/85 hover:shadow-[0_18px_60px_-40px_rgba(2,6,23,0.5)]",
                                "dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                                  {symptom.name}
                                </div>
                                <Badge variant="glass" className="shrink-0">
                                  {symptom.is_system ? "System" : "Custom"}
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {filteredSymptoms.map((symptom: DatabaseSymptom) => (
                      <button
                        key={symptom.id}
                        type="button"
                        onClick={() => handleSelectSymptom(symptom)}
                        className={cn(
                          "group text-left rounded-[18px] border p-3 transition-all",
                          "border-black/10 bg-white/60 hover:bg-white/85 hover:shadow-[0_18px_60px_-40px_rgba(2,6,23,0.5)]",
                          "dark:border-white/10 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {symptom.name}
                          </div>
                          <Badge variant="glass" className="shrink-0">
                            {symptom.is_system ? "System" : "Custom"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {getCategoryLabel(symptom.category)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Selected Symptom */}
              <div className="relative overflow-hidden rounded-[22px] border border-black/10 dark:border-white/10 p-4">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(600px_circle_at_15%_0%,rgba(245,158,11,0.18),transparent_60%),linear-gradient(to_bottom,rgba(255,255,255,0.35),rgba(255,255,255,0))] dark:bg-[radial-gradient(600px_circle_at_15%_0%,rgba(245,158,11,0.12),transparent_60%),linear-gradient(to_bottom,rgba(2,6,23,0.12),rgba(2,6,23,0))]"
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selectedSymptom.name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {getCategoryLabel(selectedSymptom.category)}
                      </Badge>
                      <Badge variant="glass">
                        {selectedSymptom.is_system ? "System" : "Custom"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedSymptom(null);
                      setEditingLog(null);
                    }}
                    aria-label="Change symptom"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Severity Slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Severity</label>
                  <span
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-[0_12px_28px_-18px_rgba(2,6,23,0.65)]",
                      SEVERITY_COLORS[severity]
                    )}
                  >
                    {severity}
                  </span>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={severity}
                  onValueChange={(value) => setSeverity(value as SymptomSeverity)}
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
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
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                  className={cn(
                    "mt-1 w-full min-h-[96px] resize-none",
                    "rounded-[var(--radius-md)] border border-black/10 bg-white/80 backdrop-blur-sm",
                    "px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-600 focus-visible:ring-offset-2 ring-offset-white",
                    "dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500 dark:ring-offset-slate-950"
                  )}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  type="button"
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
                  type="button"
                  variant="warning"
                  className="flex-1"
                  onClick={handleLogSymptom}
                  disabled={createLog.isPending || updateLog.isPending}
                >
                  {(createLog.isPending || updateLog.isPending) ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {editingLog ? "Update" : "Log symptom"}
                </Button>
              </div>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function SymptomsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-48 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
      <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-[20px] animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
    </div>
  );
}
