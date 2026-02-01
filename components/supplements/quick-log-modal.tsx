"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

interface DietaryAttributes {
  thirdPartyTested?: boolean;
  thirdPartyTesters?: string[];
  kosher?: boolean;
  kosherCertifier?: string;
  halal?: boolean;
  halalCertifier?: string;
  vegan?: boolean;
  vegetarian?: boolean;
  glutenFree?: boolean;
  [key: string]: unknown;
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
  attributes: DietaryAttributes | null;
  is_verified: boolean;
  supplement_ingredients: SupplementIngredient[];
}

interface QuickLogModalProps {
  supplements: Supplement[];
  isLoading: boolean;
  isLogging: boolean;
  onLog: (supplement: Supplement) => void;
  onClose: () => void;
}

export function QuickLogModal({
  supplements,
  isLoading,
  isLogging,
  onLog,
  onClose,
}: QuickLogModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end lg:items-center justify-center z-50 animate-fade-in">
      <Card className="w-full max-w-lg mx-4 mb-4 lg:mb-0 max-h-[80vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Log Supplement</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a supplement to log
          </p>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
            </div>
          ) : supplements.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-6">
              No supplements in database. Use the &quot;Add New&quot; tab to add supplements.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {supplements.map((supplement) => (
                <button
                  key={supplement.id}
                  onClick={() => onLog(supplement)}
                  disabled={isLogging}
                  className="p-3 rounded-[var(--radius-md)] bg-slate-100 dark:bg-slate-800 text-left hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  <p className="font-medium text-sm">{supplement.name}</p>
                  {supplement.serving_size && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {supplement.serving_size}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
