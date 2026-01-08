"use client";

import { useState, useEffect } from "react";
import { Settings, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useProfileStore,
  CONDITION_LABELS,
} from "@/lib/stores/profile";
import type { HealthCondition, NutrientGoals } from "@/types";
import { cn } from "@/lib/utils/cn";

const CONDITION_GROUPS: {
  title: string;
  conditions: HealthCondition[];
}[] = [
  {
    title: "Pregnancy & Nursing",
    conditions: [
      "pregnancy_first_trimester",
      "pregnancy_second_trimester",
      "pregnancy_third_trimester",
      "breastfeeding",
    ],
  },
  {
    title: "Fitness Goals",
    conditions: ["athletic_training", "weight_loss", "weight_gain"],
  },
  {
    title: "Health Conditions",
    conditions: ["heart_health", "diabetes_management", "iron_deficiency", "bone_health"],
  },
  {
    title: "Dietary Preferences",
    conditions: ["vegetarian", "vegan"],
  },
];

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const {
    profile,
    initProfile,
    updateConditions,
    updateGoals,
    getAdjustedGoals,
  } = useProfileStore();

  const [localGoals, setLocalGoals] = useState<NutrientGoals>({
    calories: 2000,
    protein: 50,
    carbs: 275,
    fat: 78,
    fiber: 28,
  });

  useEffect(() => {
    setMounted(true);
    initProfile();
  }, [initProfile]);

  useEffect(() => {
    if (profile) {
      setLocalGoals(profile.goals);
    }
  }, [profile]);

  if (!mounted || !profile) return <SettingsSkeleton />;

  const adjustedGoals = getAdjustedGoals();

  const toggleCondition = (condition: HealthCondition) => {
    const current = profile.conditions;

    if (condition === "none") {
      updateConditions(["none"]);
      return;
    }

    let newConditions: HealthCondition[];

    if (current.includes(condition)) {
      newConditions = current.filter((c) => c !== condition);
      if (newConditions.length === 0) {
        newConditions = ["none"];
      }
    } else {
      newConditions = current.filter((c) => c !== "none");
      newConditions.push(condition);
    }

    updateConditions(newConditions);
  };

  const handleGoalChange = (key: keyof NutrientGoals, value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalGoals((prev) => ({ ...prev, [key]: numValue }));
  };

  const saveGoals = () => {
    updateGoals(localGoals);
  };

  const hasGoalsChanged = JSON.stringify(localGoals) !== JSON.stringify(profile.goals);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Health Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Health Conditions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select conditions to get personalized nutrient recommendations
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {CONDITION_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.conditions.map((condition) => {
                  const isSelected = profile.conditions.includes(condition);
                  return (
                    <button
                      key={condition}
                      onClick={() => toggleCondition(condition)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                        isSelected
                          ? "bg-primary-600 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                      {CONDITION_LABELS[condition]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* None option */}
          <div>
            <button
              onClick={() => toggleCondition("none")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                profile.conditions.includes("none")
                  ? "bg-primary-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {profile.conditions.includes("none") && (
                <Check className="w-4 h-4" />
              )}
              No specific conditions
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Nutrient Goals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Daily Goals</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set your daily nutrient targets
              </p>
            </div>
            {!profile.conditions.includes("none") && (
              <Badge variant="secondary">
                Adjusted for conditions
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Calories (kcal)</label>
              <Input
                type="number"
                value={localGoals.calories}
                onChange={(e) => handleGoalChange("calories", e.target.value)}
                className="mt-1"
              />
              {adjustedGoals.calories !== localGoals.calories && (
                <p className="text-xs text-primary-600 mt-1">
                  Adjusted: {adjustedGoals.calories} kcal
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Protein (g)</label>
              <Input
                type="number"
                value={localGoals.protein}
                onChange={(e) => handleGoalChange("protein", e.target.value)}
                className="mt-1"
              />
              {adjustedGoals.protein !== localGoals.protein && (
                <p className="text-xs text-primary-600 mt-1">
                  Adjusted: {adjustedGoals.protein}g
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Carbohydrates (g)</label>
              <Input
                type="number"
                value={localGoals.carbs}
                onChange={(e) => handleGoalChange("carbs", e.target.value)}
                className="mt-1"
              />
              {adjustedGoals.carbs !== localGoals.carbs && (
                <p className="text-xs text-primary-600 mt-1">
                  Adjusted: {adjustedGoals.carbs}g
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Fat (g)</label>
              <Input
                type="number"
                value={localGoals.fat}
                onChange={(e) => handleGoalChange("fat", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fiber (g)</label>
              <Input
                type="number"
                value={localGoals.fiber}
                onChange={(e) => handleGoalChange("fiber", e.target.value)}
                className="mt-1"
              />
              {adjustedGoals.fiber !== localGoals.fiber && (
                <p className="text-xs text-primary-600 mt-1">
                  Adjusted: {adjustedGoals.fiber}g
                </p>
              )}
            </div>
          </div>

          {hasGoalsChanged && (
            <Button onClick={saveGoals} className="w-full">
              Save Goals
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Your data is stored locally in your browser. No account required.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const data = {
                profile: localStorage.getItem("tibera-profile"),
                meals: localStorage.getItem("tibera-meals"),
                sleep: localStorage.getItem("tibera-sleep"),
                symptoms: localStorage.getItem("tibera-symptoms"),
                supplements: localStorage.getItem("tibera-supplements"),
                shopping: localStorage.getItem("tibera-shopping"),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `tibera-backup-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
            }}
          >
            Export Data
          </Button>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to clear all data? This cannot be undone."
                )
              ) {
                localStorage.removeItem("tibera-profile");
                localStorage.removeItem("tibera-meals");
                localStorage.removeItem("tibera-sleep");
                localStorage.removeItem("tibera-symptoms");
                localStorage.removeItem("tibera-supplements");
                localStorage.removeItem("tibera-shopping");
                window.location.reload();
              }
            }}
          >
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tibera Health v1.0.0
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            A comprehensive health tracking platform for nutrition, sleep,
            symptoms, and supplements.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-muted rounded-lg animate-pulse w-48" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
