"use client";

import { useState, useEffect, useMemo } from "react";
import { Settings, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useGoals,
  useUpdateGoals,
  useUserHealthConditions,
  useSetHealthConditions,
  useHealthConditionsList,
} from "@/lib/hooks";
import type { HealthCondition, NutrientGoals } from "@/types";
import { cn } from "@/lib/utils/cn";

// Database types
interface DatabaseGoals {
  id: string;
  user_id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  custom_nutrients: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

interface DatabaseHealthCondition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  goal_adjustments: Record<string, number> | null;
}

interface DatabaseUserHealthCondition {
  id: string;
  user_id: string;
  condition_code: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  created_at: string;
  condition: DatabaseHealthCondition | null;
}

const CONDITION_LABELS: Record<string, string> = {
  pregnancy_first_trimester: "Pregnancy (1st Trimester)",
  pregnancy_second_trimester: "Pregnancy (2nd Trimester)",
  pregnancy_third_trimester: "Pregnancy (3rd Trimester)",
  breastfeeding: "Breastfeeding",
  athletic_training: "Athletic Training",
  weight_loss: "Weight Loss",
  weight_gain: "Weight Gain",
  heart_health: "Heart Health",
  diabetes_management: "Diabetes Management",
  iron_deficiency: "Iron Deficiency",
  bone_health: "Bone Health",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  none: "No specific conditions",
};

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

// Default goals
const DEFAULT_GOALS: NutrientGoals = {
  calories: 2000,
  protein: 50,
  carbs: 275,
  fat: 78,
  fiber: 28,
};

export default function SettingsPage() {
  // Supabase hooks
  const { data: goalsData, isLoading: goalsLoading } = useGoals();
  const { data: userConditions = [], isLoading: conditionsLoading } = useUserHealthConditions();
  const { data: allConditions = [] } = useHealthConditionsList();

  // Mutations
  const updateGoals = useUpdateGoals();
  const setHealthConditions = useSetHealthConditions();

  const [localGoals, setLocalGoals] = useState<NutrientGoals>(DEFAULT_GOALS);

  // Sync local goals with database goals when loaded
  useEffect(() => {
    if (goalsData) {
      setLocalGoals({
        calories: goalsData.calories ?? DEFAULT_GOALS.calories,
        protein: goalsData.protein ?? DEFAULT_GOALS.protein,
        carbs: goalsData.carbs ?? DEFAULT_GOALS.carbs,
        fat: goalsData.fat ?? DEFAULT_GOALS.fat,
        fiber: goalsData.fiber ?? DEFAULT_GOALS.fiber,
      });
    }
  }, [goalsData]);

  // Get active condition codes from user conditions
  const activeConditionCodes = useMemo(() => {
    if (!userConditions || userConditions.length === 0) return ["none"];
    return userConditions.map((uc: DatabaseUserHealthCondition) => uc.condition_code);
  }, [userConditions]);

  const isLoading = goalsLoading || conditionsLoading;

  if (isLoading) return <SettingsSkeleton />;

  // Calculate adjusted goals based on conditions
  const adjustedGoals = useMemo(() => {
    const adjusted = { ...localGoals };
    const adjustableKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

    // Apply adjustments from each condition
    userConditions.forEach((uc: DatabaseUserHealthCondition) => {
      const adjustments = uc.condition?.goal_adjustments;
      if (adjustments) {
        adjustableKeys.forEach(key => {
          const value = adjustments[key];
          if (typeof value === 'number') {
            adjusted[key] = Math.round(adjusted[key] * (1 + value / 100));
          }
        });
      }
    });

    return adjusted;
  }, [localGoals, userConditions]);

  const toggleCondition = (conditionCode: HealthCondition) => {
    if (conditionCode === "none") {
      setHealthConditions.mutate(["none"]);
      return;
    }

    let newConditions: string[];

    if (activeConditionCodes.includes(conditionCode)) {
      // Remove the condition
      newConditions = activeConditionCodes.filter((c: string) => c !== conditionCode && c !== "none");
      if (newConditions.length === 0) {
        newConditions = ["none"];
      }
    } else {
      // Add the condition
      newConditions = activeConditionCodes.filter((c: string) => c !== "none");
      newConditions.push(conditionCode);
    }

    setHealthConditions.mutate(newConditions);
  };

  const handleGoalChange = (key: keyof NutrientGoals, value: string) => {
    const numValue = parseInt(value) || 0;
    setLocalGoals((prev) => ({ ...prev, [key]: numValue }));
  };

  const saveGoals = () => {
    updateGoals.mutate(localGoals);
  };

  // Check if goals have changed from saved values
  const hasGoalsChanged = goalsData
    ? JSON.stringify(localGoals) !== JSON.stringify({
        calories: goalsData.calories,
        protein: goalsData.protein,
        carbs: goalsData.carbs,
        fat: goalsData.fat,
        fiber: goalsData.fiber,
      })
    : JSON.stringify(localGoals) !== JSON.stringify(DEFAULT_GOALS);

  const hasConditions = !activeConditionCodes.includes("none");

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
          <p className="text-sm text-gray-500">
            Select conditions to get personalized nutrient recommendations
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {CONDITION_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {group.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                {group.conditions.map((condition) => {
                  const isSelected = activeConditionCodes.includes(condition);
                  return (
                    <button
                      key={condition}
                      onClick={() => toggleCondition(condition)}
                      disabled={setHealthConditions.isPending}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                        isSelected
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-100/80",
                        setHealthConditions.isPending && "opacity-50 cursor-not-allowed"
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
              disabled={setHealthConditions.isPending}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                activeConditionCodes.includes("none")
                  ? "bg-primary-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-100/80",
                setHealthConditions.isPending && "opacity-50 cursor-not-allowed"
              )}
            >
              {activeConditionCodes.includes("none") && (
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
              <p className="text-sm text-gray-500">
                Set your daily nutrient targets
              </p>
            </div>
            {hasConditions && (
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
              {hasConditions && adjustedGoals.calories !== localGoals.calories && (
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
              {hasConditions && adjustedGoals.protein !== localGoals.protein && (
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
              {hasConditions && adjustedGoals.carbs !== localGoals.carbs && (
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
              {hasConditions && adjustedGoals.fiber !== localGoals.fiber && (
                <p className="text-xs text-primary-600 mt-1">
                  Adjusted: {adjustedGoals.fiber}g
                </p>
              )}
            </div>
          </div>

          {hasGoalsChanged && (
            <Button
              onClick={saveGoals}
              className="w-full"
              disabled={updateGoals.isPending}
            >
              {updateGoals.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
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
          <p className="text-sm text-gray-500">
            Your data is securely stored in the cloud. When you create an account,
            your data will be associated with your profile.
          </p>
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-blue-700">Connected to database</span>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Tibera Health v1.0.0
          </p>
          <p className="text-sm text-gray-500 mt-2">
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}
