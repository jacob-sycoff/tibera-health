"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NutrientBar } from "@/components/charts/nutrient-bar";
import { useMealsStore, calculateDailyNutrients } from "@/lib/stores/meals";
import { useProfileStore } from "@/lib/stores/profile";
import { TRACKED_NUTRIENTS } from "@/lib/api/usda";
import type { MealType } from "@/types";

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export default function FoodTrackerPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { getMealsByDate, deleteMeal, removeItemFromMeal } = useMealsStore();
  const { getAdjustedGoals } = useProfileStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <FoodTrackerSkeleton />;

  const meals = getMealsByDate(selectedDate);
  const goals = getAdjustedGoals();
  const dailyNutrients = calculateDailyNutrients(meals);

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
    return meals.filter((meal) => meal.mealType === type);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Food Tracker</h1>
        <Link href="/food/log">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Log Food
          </Button>
        </Link>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium">{formatDate(selectedDate)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateDate(1)}
          disabled={isToday}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-600">
                {Math.round(dailyNutrients["1008"] || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Calories</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {Math.round(dailyNutrients["1003"] || 0)}g
              </p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {Math.round(dailyNutrients["1005"] || 0)}g
              </p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {Math.round(dailyNutrients["1004"] || 0)}g
              </p>
              <p className="text-xs text-muted-foreground">Fat</p>
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
      <Tabs defaultValue="all">
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
          <TabsTrigger value="nutrients" className="flex-1">Nutrients</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {MEAL_TYPE_ORDER.map((mealType) => {
            const typeMeals = getMealsByType(mealType);
            const totalCalories = typeMeals.reduce((sum, meal) => {
              return (
                sum +
                meal.items.reduce((itemSum, item) => {
                  const cal = item.food.nutrients.find(
                    (n) => n.nutrientId === "1008"
                  );
                  return itemSum + (cal?.amount || 0) * item.servings;
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No {mealType} logged
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {typeMeals.map((meal) =>
                        meal.items.map((item) => {
                          const cal = item.food.nutrients.find(
                            (n) => n.nutrientId === "1008"
                          );
                          const itemCalories =
                            (cal?.amount || 0) * item.servings;

                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between py-2 border-b border-border last:border-0"
                            >
                              <div className="flex-1 min-w-0 mr-4">
                                <p className="font-medium text-sm truncate">
                                  {item.food.description}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {item.servings} serving
                                  {item.servings !== 1 ? "s" : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium whitespace-nowrap">
                                  {Math.round(itemCalories)} kcal
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    removeItemFromMeal(meal.id, item.id)
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
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
          })}
        </TabsContent>

        <TabsContent value="nutrients" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Detailed Nutrients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vitamins */}
              <div>
                <h3 className="font-medium mb-3">Vitamins</h3>
                <div className="space-y-3">
                  <NutrientBar
                    name="Vitamin A"
                    value={dailyNutrients["1106"] || 0}
                    max={900}
                    unit="mcg"
                    showWarning
                  />
                  <NutrientBar
                    name="Vitamin C"
                    value={dailyNutrients["1162"] || 0}
                    max={90}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Vitamin D"
                    value={dailyNutrients["1114"] || 0}
                    max={20}
                    unit="mcg"
                    showWarning
                  />
                  <NutrientBar
                    name="Vitamin B12"
                    value={dailyNutrients["1178"] || 0}
                    max={2.4}
                    unit="mcg"
                    showWarning
                  />
                </div>
              </div>

              {/* Minerals */}
              <div>
                <h3 className="font-medium mb-3">Minerals</h3>
                <div className="space-y-3">
                  <NutrientBar
                    name="Iron"
                    value={dailyNutrients["1089"] || 0}
                    max={18}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Calcium"
                    value={dailyNutrients["1087"] || 0}
                    max={1000}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Magnesium"
                    value={dailyNutrients["1090"] || 0}
                    max={400}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Potassium"
                    value={dailyNutrients["1092"] || 0}
                    max={4700}
                    unit="mg"
                    showWarning
                  />
                  <NutrientBar
                    name="Zinc"
                    value={dailyNutrients["1095"] || 0}
                    max={11}
                    unit="mg"
                    showWarning
                  />
                </div>
              </div>

              {/* Other */}
              <div>
                <h3 className="font-medium mb-3">Other</h3>
                <div className="space-y-3">
                  <NutrientBar
                    name="Fiber"
                    value={dailyNutrients["1079"] || 0}
                    max={28}
                    unit="g"
                    showWarning
                  />
                  <NutrientBar
                    name="Sodium"
                    value={dailyNutrients["1093"] || 0}
                    max={2300}
                    unit="mg"
                  />
                  <NutrientBar
                    name="Cholesterol"
                    value={dailyNutrients["1253"] || 0}
                    max={300}
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
      <div className="h-10 bg-muted rounded-lg animate-pulse w-48" />
      <div className="h-12 bg-muted rounded-lg animate-pulse" />
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
