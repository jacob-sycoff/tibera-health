"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Trash2, Loader2, Camera, Sparkles, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NutrientBar } from "@/components/charts/nutrient-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useMealLogsByDate, useDeleteMealItem, useUpdateMealItem, type MealLog } from "@/lib/hooks/use-meals";
import { useEffectiveGoals } from "@/lib/hooks";
import { getFoodDetails, searchFoods } from "@/lib/api/usda";
import type { FoodNutrient } from "@/types";
import type { MealType } from "@/types";

// Calculate daily nutrient totals from Supabase meal logs
function calculateDailyNutrients(meals: MealLog[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const meal of meals) {
    for (const item of meal.meal_items) {
      // Get nutrients from custom_food_nutrients (stored when logging USDA foods)
      const customNutrients = item.custom_food_nutrients || {};

      // Sum nutrients, multiplying by servings
      for (const [id, amount] of Object.entries(customNutrients)) {
        const numericAmount = typeof amount === 'number' ? amount : 0;
        totals[id] = (totals[id] || 0) + (numericAmount * item.servings);
      }
    }
  }

  return totals;
}

function transformNutrients(nutrients: FoodNutrient[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const n of nutrients) result[n.nutrientId] = n.amount;
  return result;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export default function FoodTrackerPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "nutrients">("all");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fixingItemId, setFixingItemId] = useState<string | null>(null);

  const { data: meals = [], isLoading } = useMealLogsByDate(selectedDate);
  const deleteMealItem = useDeleteMealItem();
  const updateMealItem = useUpdateMealItem();
  const { goals } = useEffectiveGoals();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setActiveTab(urlParams.get("tab") === "nutrients" ? "nutrients" : "all");
    setMounted(true);
  }, []);

  if (!mounted) return <FoodTrackerSkeleton />;

  const dailyNutrients = calculateDailyNutrients(meals);

  const goalMax = (usdaId: string, fallback: number) => {
    const value = goals.customNutrients?.[usdaId];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };

  const navigateDate = (direction: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  const isToday =
    selectedDate === new Date().toISOString().split("T")[0];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday) return "Today";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getMealsByType = (type: MealType) => {
    return meals.filter((meal) => meal.meal_type === type);
  };

  const fixNutritionForItem = async (itemId: string, name: string) => {
    if (!name.trim()) return;
    setFixingItemId(itemId);
    try {
      const results = await searchFoods(name, 5);
      const best = results[0];
      if (!best) return;
      const food = await getFoodDetails(best.fdcId);
      if (!food) return;
      updateMealItem.mutate({
        id: itemId,
        updates: {
          custom_food_name: food.description,
          custom_food_nutrients: transformNutrients(food.nutrients),
        },
      });
    } finally {
      setFixingItemId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Food Tracker"
        action={
          <div className="flex items-center gap-2">
            <Link href="/food/guides">
              <Button variant="outline">Guides</Button>
            </Link>
            <Link href="/food/log/photo">
              <Button variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Photo
              </Button>
            </Link>
            <Link href="/food/log">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Log Food
              </Button>
            </Link>
          </div>
        }
      />

      {/* Date Navigation */}
      <Card className="!p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium text-slate-900 dark:text-slate-100">{formatDate(selectedDate)}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate(1)}
            disabled={isToday}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1008"] || 0)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Calories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1003"] || 0)}g
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Protein</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1005"] || 0)}g
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Carbs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(dailyNutrients["1004"] || 0)}g
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Fat</p>
            </div>
          </div>

          <NutrientBar
            name="Calories"
            value={dailyNutrients["1008"] || 0}
            max={goals.calories}
            unit="kcal"
          />
        </CardContent>
      </Card>

      {/* Meals by Type */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "all" | "nutrients")}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="nutrients" className="flex-1">Nutrients</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500 dark:text-slate-400">Loading meals...</span>
            </div>
          ) : (
            MEAL_TYPE_ORDER.map((mealType) => {
              const typeMeals = getMealsByType(mealType);
              const totalCalories = typeMeals.reduce((sum, meal) => {
                return (
                  sum +
                  meal.meal_items.reduce((itemSum, item) => {
                    const cal =
                      item.custom_food_nutrients?.["1008"] ??
                      item.custom_food_nutrients?.["208"] ??
                      0;
                    return itemSum + cal * item.servings;
                  }, 0)
                );
              }, 0);

              return (
                <Card key={mealType}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {MEAL_TYPE_LABELS[mealType]}
                      </CardTitle>
                      {totalCalories > 0 && (
                        <Badge variant="secondary">
                          {Math.round(totalCalories)} kcal
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {typeMeals.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No {mealType} logged yet
                        </p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {typeMeals.map((meal) =>
                          meal.meal_items.map((item) => {
                            const cal =
                              item.custom_food_nutrients?.["1008"] ??
                              item.custom_food_nutrients?.["208"] ??
                              0;
                            const itemCalories = cal * item.servings;
                            const canFix =
                              itemCalories === 0 &&
                              !!item.custom_food_name &&
                              !deleteMealItem.isPending &&
                              !updateMealItem.isPending;

                            return (
                              <li
                                key={item.id}
                                className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                              >
                                <div className="flex-1 min-w-0 mr-4">
                                  <p className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                                    {item.custom_food_name || "Unknown food"}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {item.servings} serving
                                    {item.servings !== 1 ? "s" : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium whitespace-nowrap text-slate-900 dark:text-slate-100">
                                    {Math.round(itemCalories)} kcal
                                  </span>
                                  {canFix && (
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-slate-400 hover:text-slate-700"
                                      disabled={fixingItemId === item.id}
                                      onClick={() =>
                                        fixNutritionForItem(
                                          item.id,
                                          item.custom_food_name || ""
                                        )
                                      }
                                      title="Recompute nutrition from USDA"
                                    >
                                      {fixingItemId === item.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-slate-400 hover:text-red-500"
                                    disabled={deleteMealItem.isPending}
                                    onClick={() => deleteMealItem.mutate(item.id)}
                                  >
                                    {deleteMealItem.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </li>
                            );
                          })
                        )}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="nutrients" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detailed Nutrients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vitamins */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Vitamins</h3>
                <div className="space-y-3">
                  <NutrientBar
                    name="Vitamin A"
                    value={dailyNutrients["1106"] || 0}
                    max={goalMax("1106", 900)}
                    unit="mcg"
                    showWarning
                  />
                  <NutrientBar
                    name="Vitamin C"
                    value={dailyNutrients["1162"] || 0}
                    max={goalMax("1162", 90)}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Vitamin D"
                    value={dailyNutrients["1114"] || 0}
                    max={goalMax("1114", 20)}
                    unit="mcg"
                    showWarning
                  />
                  <NutrientBar
                    name="Vitamin B12"
                    value={dailyNutrients["1178"] || 0}
                    max={goalMax("1178", 2.4)}
                    unit="mcg"
                    showWarning
                  />
                </div>
              </div>

              {/* Minerals */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Minerals</h3>
                <div className="space-y-3">
                  <NutrientBar
                    name="Iron"
                    value={dailyNutrients["1089"] || 0}
                    max={goalMax("1089", 18)}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Calcium"
                    value={dailyNutrients["1087"] || 0}
                    max={goalMax("1087", 1000)}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Magnesium"
                    value={dailyNutrients["1090"] || 0}
                    max={goalMax("1090", 400)}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Potassium"
                    value={dailyNutrients["1092"] || 0}
                    max={goalMax("1092", 4700)}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Zinc"
                    value={dailyNutrients["1095"] || 0}
                    max={goalMax("1095", 11)}
                    unit="mg"
                    showWarning
                  />
                </div>
              </div>

              {/* Other */}
              <div>
                <h3 className="font-medium mb-3 text-slate-900 dark:text-slate-100">Other</h3>
                <div className="space-y-3">
                  <NutrientBar
                    name="Fiber"
                    value={dailyNutrients["1079"] || 0}
                    max={goals.fiber}
                    unit="g"
                    showWarning
                  />
                  <NutrientBar
                    name="Sodium"
                    value={dailyNutrients["1093"] || 0}
                    max={goalMax("1093", 2300)}
                    unit="mg"
                  />
                  <NutrientBar
                    name="Cholesterol"
                    value={dailyNutrients["1253"] || 0}
                    max={goalMax("1253", 300)}
                    unit="mg"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FoodTrackerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse w-48" />
      <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
    </div>
  );
}
