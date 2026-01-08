"use client";

import { useState, useEffect } from "react";
import { Pill, Plus, ChevronLeft, ChevronRight, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useSupplementsStore,
  SUPPLEMENTS_LIBRARY,
} from "@/lib/stores/supplements";
import type { Supplement } from "@/types";
import { cn } from "@/lib/utils/cn";

export default function SupplementsPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSupplement, setSelectedSupplement] = useState<Supplement | null>(
    null
  );
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");

  const {
    addSupplementLog,
    deleteSupplementLog,
    getLogsByDate,
    getAllSupplements,
  } = useSupplementsStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <SupplementsSkeleton />;

  const todaysLogs = getLogsByDate(selectedDate);
  const allSupplements = getAllSupplements();

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const handleSelectSupplement = (supplement: Supplement) => {
    setSelectedSupplement(supplement);
    setDosage(supplement.recommendedDosage?.toString() || "");
    setNotes("");
  };

  const handleLogSupplement = () => {
    if (!selectedSupplement || !dosage) return;

    addSupplementLog({
      supplementId: selectedSupplement.id,
      supplementName: selectedSupplement.name,
      dosage: parseFloat(dosage),
      unit: selectedSupplement.dosageUnit,
      dateTime: new Date(`${selectedDate}T${new Date().toTimeString().slice(0, 5)}`),
      notes: notes || undefined,
    });

    setSelectedSupplement(null);
    setShowAddForm(false);
  };

  const quickLog = (supplement: Supplement) => {
    addSupplementLog({
      supplementId: supplement.id,
      supplementName: supplement.name,
      dosage: supplement.recommendedDosage || 1,
      unit: supplement.dosageUnit,
      dateTime: new Date(),
    });
  };

  // Check which supplements have been taken today
  const takenSupplements = new Set(todaysLogs.map((log) => log.supplementId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Pill className="w-5 h-5 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold">Supplements</h1>
        </div>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Log
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

      {/* Quick Add - Common Supplements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Quick Add</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {SUPPLEMENTS_LIBRARY.slice(0, 8).map((supplement) => {
              const taken = takenSupplements.has(supplement.id);
              return (
                <button
                  key={supplement.id}
                  onClick={() => !taken && quickLog(supplement)}
                  disabled={taken}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg text-left transition-colors",
                    taken
                      ? "bg-primary-50 border-2 border-primary-200"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  <span className="font-medium text-sm">{supplement.name}</span>
                  {taken && <Check className="w-4 h-4 text-primary-600" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Supplements */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Taken Today</CardTitle>
            <Badge variant="secondary">
              {todaysLogs.length} supplement{todaysLogs.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {todaysLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">
              No supplements logged today
            </p>
          ) : (
            <ul className="space-y-2">
              {todaysLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium">{log.supplementName}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.dosage} {log.unit} at{" "}
                      {new Date(log.dateTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteSupplementLog(log.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add Supplement Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end lg:items-center justify-center z-50">
          <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[80vh] overflow-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Log Supplement</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedSupplement(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedSupplement ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Select a supplement to log
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {allSupplements.map((supplement) => (
                      <button
                        key={supplement.id}
                        onClick={() => handleSelectSupplement(supplement)}
                        className="p-3 rounded-lg bg-muted text-left hover:bg-muted/80 transition-colors"
                      >
                        <p className="font-medium text-sm">{supplement.name}</p>
                        {supplement.recommendedDosage && (
                          <p className="text-xs text-muted-foreground">
                            {supplement.recommendedDosage} {supplement.dosageUnit}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected Supplement */}
                  <div className="text-center py-4 bg-purple-50 rounded-lg">
                    <p className="text-lg font-bold text-purple-800">
                      {selectedSupplement.name}
                    </p>
                  </div>

                  {/* Dosage Input */}
                  <div>
                    <label className="text-sm font-medium">Dosage</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        placeholder="Amount"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground">
                        {selectedSupplement.dosageUnit}
                      </span>
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
                      onClick={() => setSelectedSupplement(null)}
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleLogSupplement}
                      disabled={!dosage}
                    >
                      Log Supplement
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

function SupplementsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-muted rounded-lg animate-pulse w-48" />
      <div className="h-12 bg-muted rounded-lg animate-pulse" />
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
