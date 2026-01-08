"use client";

import { useState, useEffect } from "react";
import { Activity, Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  useSymptomsStore,
  SYMPTOMS_LIBRARY,
  getCategoryLabel,
} from "@/lib/stores/symptoms";
import type { Symptom, SymptomSeverity, SymptomCategory } from "@/types";
import { cn } from "@/lib/utils/cn";

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

const CATEGORIES: SymptomCategory[] = [
  "digestive",
  "energy",
  "mood",
  "pain",
  "skin",
  "respiratory",
  "other",
];

export default function SymptomsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState<Symptom | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>(5);
  const [notes, setNotes] = useState("");
  const [activeCategory, setActiveCategory] = useState<SymptomCategory | "all">(
    "all"
  );

  const {
    addSymptomLog,
    deleteSymptomLog,
    getLogsByDate,
    getAllSymptoms,
  } = useSymptomsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <SymptomsSkeleton />;

  const todaysLogs = getLogsByDate(selectedDate);
  const allSymptoms = getAllSymptoms();

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const handleSelectSymptom = (symptom: Symptom) => {
    setSelectedSymptom(symptom);
    setSeverity(5);
    setNotes("");
  };

  const handleLogSymptom = () => {
    if (!selectedSymptom) return;

    addSymptomLog({
      symptomId: selectedSymptom.id,
      symptomName: selectedSymptom.name,
      severity,
      dateTime: new Date(`${selectedDate}T${new Date().toTimeString().slice(0, 5)}`),
      notes: notes || undefined,
    });

    setSelectedSymptom(null);
    setShowAddForm(false);
  };

  const filteredSymptoms =
    activeCategory === "all"
      ? allSymptoms
      : allSymptoms.filter((s) => s.category === activeCategory);

  const groupedSymptoms = CATEGORIES.reduce((acc, category) => {
    acc[category] = filteredSymptoms.filter((s) => s.category === category);
    return acc;
  }, {} as Record<SymptomCategory, Symptom[]>);

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

      {/* Today's Symptoms */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Logged Symptoms</CardTitle>
        </CardHeader>
        <CardContent>
          {todaysLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No symptoms logged for this day
            </p>
          ) : (
            <ul className="space-y-3">
              {todaysLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold",
                        SEVERITY_COLORS[log.severity]
                      )}
                    >
                      {log.severity}
                    </div>
                    <div>
                      <p className="font-medium">{log.symptomName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.dateTime).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteSymptomLog(log.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add Symptom Modal/Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Log Symptom</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedSymptom(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedSymptom ? (
                <>
                  {/* Category Filter */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    <button
                      onClick={() => setActiveCategory("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                        activeCategory === "all"
                          ? "bg-primary-600 text-white"
                          : "bg-muted text-muted-foreground"
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
                            ? "bg-primary-600 text-white"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {getCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>

                  {/* Symptom Selection */}
                  <div className="space-y-4">
                    {activeCategory === "all"
                      ? CATEGORIES.map((category) => {
                          const symptoms = groupedSymptoms[category];
                          if (symptoms.length === 0) return null;
                          return (
                            <div key={category}>
                              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                {getCategoryLabel(category)}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {symptoms.map((symptom) => (
                                  <button
                                    key={symptom.id}
                                    onClick={() => handleSelectSymptom(symptom)}
                                    className="px-3 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
                                  >
                                    {symptom.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      : (
                        <div className="flex flex-wrap gap-2">
                          {filteredSymptoms.map((symptom) => (
                            <button
                              key={symptom.id}
                              onClick={() => handleSelectSymptom(symptom)}
                              className="px-3 py-2 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
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
                  <div className="text-center py-4 bg-muted rounded-lg">
                    <p className="text-lg font-bold">{selectedSymptom.name}</p>
                    <Badge className="mt-1">
                      {getCategoryLabel(selectedSymptom.category)}
                    </Badge>
                  </div>

                  {/* Severity Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Severity</label>
                      <span
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold",
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
                      onValueChange={(value) =>
                        setSeverity(value as SymptomSeverity)
                      }
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Mild</span>
                      <span>Severe</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium">
                      Notes (optional)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional details..."
                      className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedSymptom(null)}
                    >
                      Back
                    </Button>
                    <Button className="flex-1" onClick={handleLogSymptom}>
                      Log Symptom
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
      <div className="h-10 bg-muted rounded-lg animate-pulse w-48" />
      <div className="h-12 bg-muted rounded-lg animate-pulse" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
