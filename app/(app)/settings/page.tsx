"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Settings, Check, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  useGoals,
  useUpdateGoals,
  useInsertGoalEvent,
  useUserHealthConditions,
  useSetHealthConditions,
  useHealthConditionsList,
  useNutrients,
} from "@/lib/hooks";
import type { HealthCondition, NutrientGoals } from "@/types";
import { cn } from "@/lib/utils/cn";
import {
  getNutrientResearchByUsdaId,
  getRelevantTargetsForAudiences,
  getResearchSlugForNutrient,
  getVirtualNutrientByKey,
  VIRTUAL_NUTRIENTS,
} from "@/lib/nutrients/research";
import { appendLocalGoalEvent, readLocalGoals, writeLocalGoals } from "@/lib/goals/local";

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

interface DatabaseNutrient {
  id: string;
  usda_id: number | null;
  name: string;
  unit: string;
  category: string;
  daily_value: number | null;
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
  none: "No specific context",
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
  customNutrients: {},
};

export default function SettingsPage() {
  const toast = useToast();

  // Supabase hooks
  const { data: goalsData, isLoading: goalsLoading } = useGoals();
  const { data: userConditions = [], isLoading: conditionsLoading } = useUserHealthConditions();
  const { data: allConditions = [], isLoading: allConditionsLoading } = useHealthConditionsList();
  const { data: nutrients = [], isLoading: nutrientsLoading } = useNutrients();

  // Mutations
  const updateGoals = useUpdateGoals();
  const insertGoalEvent = useInsertGoalEvent();
  const setHealthConditions = useSetHealthConditions();

  const [localGoals, setLocalGoals] = useState<NutrientGoals>(DEFAULT_GOALS);
  const [nutrientQuery, setNutrientQuery] = useState("");
  const [selectedNutrientKey, setSelectedNutrientKey] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("custom");
  const [customTarget, setCustomTarget] = useState<string>("");

  // Sync local goals with database goals when loaded
  useEffect(() => {
    const local = readLocalGoals();

    if (goalsData) {
      const dbCustom = (goalsData.custom_nutrients ?? {}) as Record<string, number>;
      const localCustom = (local?.customNutrients ?? {}) as Record<string, number>;

      const nextGoals: NutrientGoals = {
        calories: goalsData.calories ?? DEFAULT_GOALS.calories,
        protein: goalsData.protein ?? DEFAULT_GOALS.protein,
        carbs: goalsData.carbs ?? DEFAULT_GOALS.carbs,
        fat: goalsData.fat ?? DEFAULT_GOALS.fat,
        fiber: goalsData.fiber ?? DEFAULT_GOALS.fiber,
        customNutrients:
          Object.keys(dbCustom).length > 0
            ? dbCustom
            : Object.keys(localCustom).length > 0
              ? localCustom
              : {},
      };
      setLocalGoals(nextGoals);
      writeLocalGoals(nextGoals);
      return;
    }

    // If DB has no row (or policies block inserts), fall back to local storage.
    if (local) setLocalGoals(local);
  }, [goalsData]);

  // Get active condition codes from user conditions
  const activeConditionCodes = useMemo(() => {
    if (!userConditions || userConditions.length === 0) return ["none"];
    return userConditions.map((uc: DatabaseUserHealthCondition) => uc.condition_code);
  }, [userConditions]);

  const conditionsByCode = useMemo(() => {
    const map = new Map<string, DatabaseHealthCondition>();
    allConditions.forEach((c: DatabaseHealthCondition) => {
      map.set(c.code, c);
    });
    return map;
  }, [allConditions]);

  // Calculate adjusted goals based on conditions
  const adjustedGoals = useMemo(() => {
    const adjusted = { ...localGoals };
    const adjustableKeys = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

    // Apply adjustments from each condition
    userConditions.forEach((uc: DatabaseUserHealthCondition) => {
      const adjustments = conditionsByCode.get(uc.condition_code)?.goal_adjustments;
      if (adjustments) {
        adjustableKeys.forEach(key => {
          const value = adjustments[key];
          if (typeof value === 'number') {
            adjusted[key] = Math.max(0, Math.round(adjusted[key] + value));
          }
        });
      }
    });

    return adjusted;
  }, [conditionsByCode, localGoals, userConditions]);

  const isLoading = goalsLoading || conditionsLoading || allConditionsLoading || nutrientsLoading;

  const nutrientIndexByUsdaId = useMemo(() => {
    const index = new Map<number, DatabaseNutrient>();
    (nutrients as DatabaseNutrient[]).forEach((n) => {
      if (typeof n.usda_id === "number") index.set(n.usda_id, n);
    });
    return index;
  }, [nutrients]);

  const selectedNutrient = useMemo(() => {
    if (!selectedNutrientKey) return null;
    const parsed = Number(selectedNutrientKey);
    if (!Number.isFinite(parsed)) return null;
    return nutrientIndexByUsdaId.get(parsed) ?? null;
  }, [nutrientIndexByUsdaId, selectedNutrientKey]);

  const selectedVirtualNutrient = useMemo(() => {
    if (!selectedNutrientKey) return null;
    if (/^\d+$/.test(selectedNutrientKey)) return null;
    return getVirtualNutrientByKey(selectedNutrientKey);
  }, [selectedNutrientKey]);

  const selectedUnit = selectedNutrient?.unit ?? selectedVirtualNutrient?.unit ?? "";
  const selectedName = selectedNutrient?.name ?? selectedVirtualNutrient?.name ?? "";

  const selectedResearchSlug = useMemo(() => {
    if (selectedNutrient && typeof selectedNutrient.usda_id === "number") {
      return getResearchSlugForNutrient({
        usdaId: selectedNutrient.usda_id,
        name: selectedNutrient.name,
      });
    }
    if (selectedVirtualNutrient) return selectedVirtualNutrient.slug;
    return null;
  }, [selectedNutrient, selectedVirtualNutrient]);

  const selectedUsdaId = useMemo(() => {
    if (selectedNutrient && typeof selectedNutrient.usda_id === "number") return selectedNutrient.usda_id;
    if (!selectedNutrientKey) return null;
    const parsed = Number(selectedNutrientKey);
    return Number.isFinite(parsed) ? parsed : null;
  }, [selectedNutrient, selectedNutrientKey]);

  const activeAudiences = useMemo(() => {
    const codes = activeConditionCodes.filter((c) => c !== "none") as HealthCondition[];
    return ["general" as const, ...codes];
  }, [activeConditionCodes]);

  const nutrientMatches = useMemo(() => {
    const query = nutrientQuery.trim().toLowerCase();
    if (!query) return [];

    const dbMatches = (nutrients as DatabaseNutrient[])
      .filter((n) => typeof n.usda_id === "number")
      .filter((n) => n.category !== "macro")
      .filter((n) => n.name.toLowerCase().includes(query))
      .slice(0, 10)
      .map((n) => ({
        key: String(n.usda_id),
        name: n.name,
        unit: n.unit,
        source: "db" as const,
      }));

    const virtualMatches = VIRTUAL_NUTRIENTS
      .filter((n) => n.name.toLowerCase().includes(query) || n.key.toLowerCase().includes(query))
      .slice(0, 10)
      .map((n) => ({
        key: n.key,
        name: n.name,
        unit: n.unit,
        source: "virtual" as const,
      }));

    const merged = [...dbMatches, ...virtualMatches];
    merged.sort((a, b) => a.name.localeCompare(b.name));
    return merged.slice(0, 10);
  }, [nutrientQuery, nutrients]);

  const presetOptions = useMemo(() => {
    if (!selectedNutrient || typeof selectedNutrient.usda_id !== "number") return [];

    const isVitaminD =
      selectedNutrient.usda_id === 1114 && selectedNutrient.unit.toLowerCase() === "mcg";
    const mcgToIu = (mcg: number) => Math.round(mcg * 40);
    const withOptionalVitaminDIu = (label: string, amount: number) => {
      if (!isVitaminD) return label;
      return `${label} (${mcgToIu(amount)} IU)`;
    };

    const research = getNutrientResearchByUsdaId(selectedNutrient.usda_id);
    const researchTargets = research ? getRelevantTargetsForAudiences(research, activeAudiences) : [];
    const researchHasDv = researchTargets.some((t) => t.id === "dv" && t.unit === selectedNutrient.unit);

    const options: Array<{
      value: string;
      label: string;
      amount: number;
    }> = [];

    if (!researchHasDv && typeof selectedNutrient.daily_value === "number") {
      options.push({
        value: "dv",
        label: withOptionalVitaminDIu(
          `Daily Value (DV): ${selectedNutrient.daily_value}${selectedNutrient.unit}`,
          selectedNutrient.daily_value
        ),
        amount: selectedNutrient.daily_value,
      });
    }

    researchTargets.forEach((t) => {
      if (t.unit !== selectedNutrient.unit) return;
      options.push({
        value: t.id,
        label: withOptionalVitaminDIu(`${t.label}: ${t.amount}${t.unit}`, t.amount),
        amount: t.amount,
      });
    });

    return options;
  }, [activeAudiences, selectedNutrient]);

  const vitaminDK2Note =
    "Note: Vitamin D helps your body absorb calcium. Many people pair vitamin D with vitamin K2 (often MK-7) because K2 is involved in activating proteins that help direct calcium to bones/teeth rather than soft tissues. Evidence is mixed and context matters; if you take blood thinners (e.g., warfarin) or have medical conditions, check with your clinician before adding K2.";

  const currentCustomGoals = useMemo(() => {
    const custom = localGoals.customNutrients ?? {};
    const rows = Object.entries(custom)
      .map(([usdaIdStr, amount]) => {
        const parsed = Number(usdaIdStr);
        const nutrient = Number.isFinite(parsed) ? nutrientIndexByUsdaId.get(parsed) ?? null : null;
        const virtual = nutrient ? null : getVirtualNutrientByKey(usdaIdStr);
        return {
          key: usdaIdStr,
          amount,
          name: nutrient?.name ?? virtual?.name ?? `Nutrient ${usdaIdStr}`,
          unit: nutrient?.unit ?? virtual?.unit ?? "",
          slug:
            nutrient && Number.isFinite(parsed)
              ? getResearchSlugForNutrient({ usdaId: parsed, name: nutrient.name })
              : virtual?.slug ?? getResearchSlugForNutrient({ usdaId: null, name: usdaIdStr }),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return rows;
  }, [localGoals.customNutrients, nutrientIndexByUsdaId]);

  if (isLoading) return <SettingsSkeleton />;

  const normalizeCustomNutrients = (input?: Record<string, number> | null) => {
    const entries = Object.entries(input ?? {}).filter(
      ([key, value]) => key && typeof value === "number" && Number.isFinite(value)
    );
    entries.sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
  };

  const toggleCondition = (conditionCode: HealthCondition) => {
    if (conditionCode === "none") {
      setHealthConditions.mutate(["none"]);
      return;
    }

    let newConditions: string[];

    if (activeConditionCodes.includes(conditionCode)) {
      newConditions = activeConditionCodes.filter((c: string) => c !== conditionCode && c !== "none");
      if (newConditions.length === 0) {
        newConditions = ["none"];
      }
    } else {
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
    const payload = {
      calories: localGoals.calories,
      protein: localGoals.protein,
      carbs: localGoals.carbs,
      fat: localGoals.fat,
      fiber: localGoals.fiber,
    };

    writeLocalGoals(localGoals);
    appendLocalGoalEvent({ eventType: "macros_saved", metadata: payload });

    updateGoals.mutate(payload, {
      onSuccess: () => {
        insertGoalEvent.mutate({
          event_type: "macros_saved",
          metadata: payload,
        });
        toast.success("Saved daily goals");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Could not save goals (saved locally)");
      },
    });
  };

  const hasMacroGoalsChanged = goalsData
    ? JSON.stringify({
        calories: localGoals.calories,
        protein: localGoals.protein,
        carbs: localGoals.carbs,
        fat: localGoals.fat,
        fiber: localGoals.fiber,
      }) !==
      JSON.stringify({
        calories: goalsData.calories,
        protein: goalsData.protein,
        carbs: goalsData.carbs,
        fat: goalsData.fat,
        fiber: goalsData.fiber,
      })
    : JSON.stringify({
        calories: localGoals.calories,
        protein: localGoals.protein,
        carbs: localGoals.carbs,
        fat: localGoals.fat,
        fiber: localGoals.fiber,
      }) !== JSON.stringify(DEFAULT_GOALS);

  const hasConditions = !activeConditionCodes.includes("none");

  const applyPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const option = presetOptions.find((o) => o.value === presetId);
    if (option) setCustomTarget(option.amount.toString());
  };

  const saveMicronutrientGoal = (key: string, amount: number, unit: string, meta?: Record<string, unknown>) => {
    const prev = localGoals.customNutrients?.[key];
    const nextCustom = {
      ...(localGoals.customNutrients ?? {}),
      [key]: amount,
    };

    setLocalGoals((prevGoals) => ({ ...prevGoals, customNutrients: nextCustom }));
    writeLocalGoals({ ...localGoals, customNutrients: nextCustom });
    appendLocalGoalEvent({
      eventType: "micronutrient_set",
      nutrientKey: key,
      amount,
      unit,
      prevAmount: typeof prev === "number" ? prev : undefined,
      metadata: meta ?? {},
    });

    updateGoals.mutate(
      { customNutrients: normalizeCustomNutrients(nextCustom) },
      {
        onSuccess: () => {
          insertGoalEvent.mutate({
            event_type: "micronutrient_set",
            nutrient_key: key,
            amount,
            unit,
            prev_amount: typeof prev === "number" ? prev : null,
            metadata: meta ?? {},
          });
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Could not save micronutrient goal (saved locally)"
          );
        },
      }
    );
  };

  const removeMicronutrientGoal = (key: string, unit: string) => {
    const prev = localGoals.customNutrients?.[key];
    const nextCustom = { ...(localGoals.customNutrients ?? {}) };
    delete nextCustom[key];

    setLocalGoals((prevGoals) => ({ ...prevGoals, customNutrients: nextCustom }));
    writeLocalGoals({ ...localGoals, customNutrients: nextCustom });
    appendLocalGoalEvent({
      eventType: "micronutrient_remove",
      nutrientKey: key,
      prevAmount: typeof prev === "number" ? prev : undefined,
      unit,
    });

    updateGoals.mutate(
      { customNutrients: normalizeCustomNutrients(nextCustom) },
      {
        onSuccess: () => {
          insertGoalEvent.mutate({
            event_type: "micronutrient_remove",
            nutrient_key: key,
            prev_amount: typeof prev === "number" ? prev : null,
            unit,
          });
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Could not save micronutrient removal (saved locally)"
          );
        },
      }
    );
  };

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
          <CardTitle className="text-lg">Personal Context</CardTitle>
          <p className="text-sm text-gray-500">
            Select life stage, goals, and dietary preferences to personalize targets
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
              No specific context
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
                Adjusted for context
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

          {hasMacroGoalsChanged && (
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

      {/* Micronutrient Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Micronutrient Goals</CardTitle>
          <p className="text-sm text-gray-500">
            Choose evidence-based targets or set your own. These goals use the nutrient&apos;s unit (mg/mcg/g).
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Add nutrient</label>
            <Input
              value={nutrientQuery}
              onChange={(e) => setNutrientQuery(e.target.value)}
              placeholder="Search (e.g., choline, iron, folate)"
            />
            {nutrientMatches.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {nutrientMatches.map((n) => (
                  <button
                    key={n.key}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => {
                      setSelectedNutrientKey(n.key);
                      setNutrientQuery("");
                      setSelectedPreset("custom");
                      const existing = localGoals.customNutrients?.[n.key];
                      setCustomTarget(typeof existing === "number" ? existing.toString() : "");
                    }}
                  >
                    <span className="font-medium text-gray-900">{n.name}</span>
                    <span className="text-xs text-gray-500">{n.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {(selectedNutrient || selectedVirtualNutrient) && selectedNutrientKey ? (
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedName}</p>
                  <p className="text-xs text-gray-500">
                    Target unit: {selectedUnit}
                    {selectedResearchSlug ? (
                      <>
                        {" • "}
                        <Link
                          href={`/nutrients/research/${selectedResearchSlug}`}
                          className="underline underline-offset-4"
                        >
                          Research
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {selectedUsdaId === 1114 ? (
                    <p className="mt-2 text-xs text-slate-600">
                      {vitaminDK2Note}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedNutrientKey(null);
                    setSelectedPreset("custom");
                    setCustomTarget("");
                  }}
                >
                  Clear
                </Button>
              </div>

              {presetOptions.length > 0 && selectedNutrient ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Preset</label>
                    <select
                      value={selectedPreset}
                      onChange={(e) => applyPreset(e.target.value)}
                      className="mt-1 w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
                    >
                      <option value="custom">Custom</option>
                      {presetOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Target ({selectedUnit})</label>
                    <Input
                      type="number"
                      value={customTarget}
                      onChange={(e) => {
                        setSelectedPreset("custom");
                        setCustomTarget(e.target.value);
                      }}
                      className="mt-1"
                      placeholder={`e.g., ${selectedNutrient.daily_value ?? ""}`}
                    />
                  </div>
                </div>
              ) : null}

              {presetOptions.length === 0 && (
                <div>
                  <label className="text-sm font-medium">Target ({selectedUnit})</label>
                  <Input
                    type="number"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              {selectedUsdaId != null ? (() => {
                const research = getNutrientResearchByUsdaId(selectedUsdaId);
                const pairings = research?.pairings ?? [];
                if (pairings.length === 0) return null;

                return (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <p className="text-sm font-medium text-gray-900">Suggested pairing</p>
                    {pairings.map((p) => (
                      <div key={p.nutrientKey} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {p.nutrientName} ({p.amount}{p.unit})
                          </p>
                          <p className="text-xs text-gray-600">{p.why}</p>
                          {p.notes ? <p className="text-xs text-gray-600 mt-1">{p.notes}</p> : null}
                        </div>
                        {typeof localGoals.customNutrients?.[p.nutrientKey] === "number" ? (
                          <span
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 text-emerald-700"
                            title="Added"
                            aria-label="Added"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              saveMicronutrientGoal(p.nutrientKey, p.amount, p.unit, {
                                paired_with: selectedUsdaId,
                              })
                            }
                          >
                            Add
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })() : null}

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    const amount = Number(customTarget);
                    if (!Number.isFinite(amount)) return;
                    saveMicronutrientGoal(selectedNutrientKey!, amount, selectedUnit, {
                      preset_id: selectedPreset !== "custom" ? selectedPreset : null,
                      nutrient_name: selectedName,
                    });
                    setSelectedPreset("custom");
                    setCustomTarget("");
                    setSelectedNutrientKey(null);
                  }}
                  disabled={!customTarget || !selectedNutrientKey || updateGoals.isPending}
                >
                  Add / Update goal
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Your micronutrient goals</p>
              <p className="text-xs text-gray-500">{currentCustomGoals.length} set</p>
            </div>

            {currentCustomGoals.length === 0 ? (
              <p className="text-sm text-gray-500">
                No micronutrient goals yet. Add one above to start tracking against a target.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y">
                {currentCustomGoals.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
                      <p className="text-xs text-gray-500">
                        Target: {row.amount}
                        {row.unit}
                        {" • "}
                        <Link
                          href={`/nutrients/research/${row.slug}`}
                          className="underline underline-offset-4"
                        >
                          Research
                        </Link>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedNutrientKey(row.key);
                          setSelectedPreset("custom");
                          setCustomTarget(String(row.amount));
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeMicronutrientGoal(row.key, row.unit);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
