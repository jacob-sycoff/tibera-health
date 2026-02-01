"use client";

import { Plus, Check, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SupplementIngredient {
  id: string;
  nutrient_name: string;
  amount: number;
  unit: string;
  daily_value_percent: number | null;
  form: string | null;
  source: string | null;
  notes: string | null;
}

interface Supplement {
  id: string;
  name: string;
  brand: string | null;
  type: string;
  serving_size: string | null;
  servings_per_container: number | null;
  other_ingredients: string[] | null;
  allergens: string[] | null;
  certifications: string[] | null;
  is_verified: boolean;
  supplement_ingredients: SupplementIngredient[];
}

interface SupplementCardProps {
  supplement: Supplement;
  onLog: () => void;
  onViewDetails: () => void;
  isLogging: boolean;
}

export function SupplementCard({
  supplement,
  onLog,
  onViewDetails,
  isLogging,
}: SupplementCardProps) {
  const topNutrients = (supplement.supplement_ingredients || []).slice(0, 4);

  return (
    <Card className="cursor-pointer hover:border-slate-900/20 dark:hover:border-slate-100/20 transition-colors">
      <CardContent className="p-4" onClick={onViewDetails}>
        <div className="flex items-start justify-between mb-3">
          <div>
            {supplement.brand && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{supplement.brand}</p>
            )}
            <h3 className="font-medium">{supplement.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {supplement.serving_size} - {supplement.supplement_ingredients?.length || 0} nutrients
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary" className="capitalize">
              {supplement.type}
            </Badge>
            {supplement.is_verified && (
              <Badge variant="outline" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
        </div>

        {/* Preview of top nutrients */}
        <div className="space-y-1 mb-3">
          {topNutrients.map((nutrient, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-slate-500 dark:text-slate-400">
                {nutrient.nutrient_name}
              </span>
              <span>
                {nutrient.amount} {nutrient.unit}
                {nutrient.daily_value_percent !== undefined && nutrient.daily_value_percent !== null && (
                  <span className="text-slate-500 dark:text-slate-400">
                    {" "}
                    ({nutrient.daily_value_percent}%)
                  </span>
                )}
              </span>
            </div>
          ))}
          {(supplement.supplement_ingredients?.length || 0) > 4 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              +{(supplement.supplement_ingredients?.length || 0) - 4} more nutrients
            </p>
          )}
        </div>

        {/* Certifications preview */}
        {supplement.certifications && supplement.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {supplement.certifications.slice(0, 3).map((cert) => (
              <Badge key={cert} variant="outline" className="text-xs">
                {cert}
              </Badge>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          size="sm"
          disabled={isLogging}
          onClick={(e) => {
            e.stopPropagation();
            onLog();
          }}
        >
          {isLogging ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-1" />
          )}
          Log
        </Button>
      </CardContent>
    </Card>
  );
}
