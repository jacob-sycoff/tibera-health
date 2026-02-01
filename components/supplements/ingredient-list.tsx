"use client";

import { Badge } from "@/components/ui/badge";
import { Leaf, FlaskConical, Info } from "lucide-react";
import type { NutrientForm, NutrientSource } from "@/types/supplements";
import { FORM_LABELS, SOURCE_LABELS } from "@/types/supplements";

interface Ingredient {
  nutrient_name: string;
  amount: number;
  unit: string;
  daily_value_percent?: number | null;
  form?: string | null;
  source?: string | null;
  notes?: string | null;
}

interface IngredientListProps {
  ingredients: Ingredient[];
  showDetails?: boolean;
}

function SourceIcon({ source }: { source: NutrientSource }) {
  switch (source) {
    case "plant":
    case "algae":
    case "whole_food":
      return <Leaf className="w-3 h-3 text-green-600" />;
    case "synthetic":
      return <FlaskConical className="w-3 h-3 text-blue-600" />;
    case "fermented":
    case "bacterial":
    case "yeast":
      return <FlaskConical className="w-3 h-3 text-purple-600" />;
    case "fish":
    case "animal":
      return <Info className="w-3 h-3 text-orange-600" />;
    default:
      return <Info className="w-3 h-3 text-slate-400 dark:text-slate-500" />;
  }
}

export function IngredientList({ ingredients, showDetails = false }: IngredientListProps) {
  return (
    <div className="space-y-2">
      {ingredients.map((ingredient, idx) => (
        <div
          key={idx}
          className="flex items-start justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{ingredient.nutrient_name}</p>
              {ingredient.form && ingredient.form !== "unknown" && (
                <Badge variant="outline" className="text-xs">
                  {FORM_LABELS[ingredient.form as NutrientForm] || ingredient.form}
                </Badge>
              )}
            </div>
            {showDetails && ingredient.source && ingredient.source !== "unknown" && (
              <div className="flex items-center gap-1 mt-1">
                <SourceIcon source={ingredient.source as NutrientSource} />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {SOURCE_LABELS[ingredient.source as NutrientSource] || ingredient.source}
                </span>
              </div>
            )}
            {ingredient.notes && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {ingredient.notes}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-medium text-sm">
              {ingredient.amount} {ingredient.unit}
            </p>
            {ingredient.daily_value_percent !== undefined && ingredient.daily_value_percent !== null && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {ingredient.daily_value_percent}% DV
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
