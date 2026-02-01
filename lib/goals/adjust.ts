import type { NutrientGoals } from "@/types";

const ADJUSTABLE_KEYS = ["calories", "protein", "carbs", "fat", "fiber"] as const;

export function applyGoalAdjustments(
  baseGoals: NutrientGoals,
  adjustments: Array<Record<string, number> | null | undefined>
): NutrientGoals {
  const next: NutrientGoals = {
    ...baseGoals,
    customNutrients: baseGoals.customNutrients ?? {},
  };

  for (const adjustment of adjustments) {
    if (!adjustment) continue;
    for (const key of ADJUSTABLE_KEYS) {
      const delta = adjustment[key];
      if (typeof delta !== "number" || !Number.isFinite(delta)) continue;
      next[key] = Math.max(0, Math.round(next[key] + delta));
    }
  }

  return next;
}

