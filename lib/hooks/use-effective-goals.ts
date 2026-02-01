import { useMemo } from "react";
import { useGoals, useUserHealthConditions } from "./use-profile";
import { useHealthConditionsList } from "./use-reference-data";
import type { NutrientGoals } from "@/types";
import { applyGoalAdjustments } from "@/lib/goals/adjust";
import { readLocalGoals } from "@/lib/goals/local";

interface DatabaseGoals {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  custom_nutrients: Record<string, number> | null;
}

interface DatabaseHealthCondition {
  code: string;
  goal_adjustments: Record<string, number> | null;
}

interface DatabaseUserHealthCondition {
  condition_code: string;
}

const DEFAULT_GOALS: NutrientGoals = {
  calories: 2000,
  protein: 50,
  carbs: 275,
  fat: 78,
  fiber: 28,
  customNutrients: {},
};

export function useEffectiveGoals() {
  const goals = useGoals();
  const userConditions = useUserHealthConditions();
  const allConditions = useHealthConditionsList();

  const conditionsByCode = useMemo(() => {
    const map = new Map<string, DatabaseHealthCondition>();
    (allConditions.data ?? []).forEach((c: DatabaseHealthCondition) => {
      map.set(c.code, c);
    });
    return map;
  }, [allConditions.data]);

  const baseGoals = useMemo((): NutrientGoals => {
    const g = goals.data as DatabaseGoals | null | undefined;
    if (!g) return readLocalGoals() ?? DEFAULT_GOALS;

    return {
      calories: g.calories ?? DEFAULT_GOALS.calories,
      protein: g.protein ?? DEFAULT_GOALS.protein,
      carbs: g.carbs ?? DEFAULT_GOALS.carbs,
      fat: g.fat ?? DEFAULT_GOALS.fat,
      fiber: g.fiber ?? DEFAULT_GOALS.fiber,
      customNutrients: g.custom_nutrients ?? {},
    };
  }, [goals.data]);

  const adjustmentList = useMemo(() => {
    const rows = (userConditions.data ?? []) as DatabaseUserHealthCondition[];
    return rows.map((uc) => conditionsByCode.get(uc.condition_code)?.goal_adjustments);
  }, [conditionsByCode, userConditions.data]);

  const effectiveGoals = useMemo(
    () => applyGoalAdjustments(baseGoals, adjustmentList),
    [adjustmentList, baseGoals]
  );

  return {
    goals: effectiveGoals,
    isLoading: goals.isLoading || userConditions.isLoading || allConditions.isLoading,
    error: goals.error || userConditions.error || allConditions.error,
    rawGoals: goals.data,
  };
}
