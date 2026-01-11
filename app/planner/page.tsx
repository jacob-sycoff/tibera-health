"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Utensils,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMealsStore, calculateDailyNutrients } from "@/lib/stores/meals";
import { useProfileStore } from "@/lib/stores/profile";
import type { MealType } from "@/types";
import { cn } from "@/lib/utils/cn";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
}

export default function MealPlannerPage() {
  const [mounted, setMounted] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    return sunday;
  });

  const { getMealsByDate, meals } = useMealsStore();
  const { getAdjustedGoals } = useProfileStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <PlannerSkeleton />;

  const weekDates = getWeekDates(currentWeekStart);
  const goals = getAdjustedGoals();
  const today = new Date().toISOString().split("T")[0];

  const navigateWeek = (direction: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + direction * 7);
    setCurrentWeekStart(newStart);
  };

  const formatWeekRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    return `${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} - ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold">Meal Planner</h1>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
        <Button variant="ghost" size="icon" onClick={() => navigateWeek(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-medium">{formatWeekRange()}</span>
        <Button variant="ghost" size="icon" onClick={() => navigateWeek(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Week Grid */}
      <div className="space-y-3">
        {weekDates.map((date) => {
          const dateStr = date.toISOString().split("T")[0];
          const dayMeals = getMealsByDate(dateStr);
          const dailyNutrients = calculateDailyNutrients(dayMeals);
          const calories = dailyNutrients["1008"] || 0;
          const isToday = dateStr === today;
          const isPast = date < new Date(today);

          return (
            <Card
              key={dateStr}
              className={cn(
                "transition-all",
                isToday && "ring-2 ring-primary-500"
              )}
            >
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isToday && "text-primary-600"
                      )}
                    >
                      {date.toLocaleDateString("en-US", {
                        weekday: "short",
                      })}
                    </span>
                    <span className="text-sm text-gray-500">
                      {date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {isToday && <Badge className="ml-2">Today</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    {calories > 0 && (
                      <span
                        className={cn(
                          "text-sm",
                          calories >= goals.calories
                            ? "text-primary-600"
                            : "text-gray-500"
                        )}
                      >
                        {Math.round(calories)} kcal
                      </span>
                    )}
                    <Link href={`/food/log?date=${dateStr}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {dayMeals.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No meals planned
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {MEAL_TYPES.map((mealType) => {
                      const mealForType = dayMeals.find(
                        (m) => m.mealType === mealType
                      );
                      const mealCalories = mealForType?.items.reduce(
                        (sum, item) => {
                          const cal = item.food.nutrients.find(
                            (n) => n.nutrientId === "1008"
                          );
                          return sum + (cal?.amount || 0) * item.servings;
                        },
                        0
                      );

                      return (
                        <div
                          key={mealType}
                          className={cn(
                            "text-center p-2 rounded-lg",
                            mealForType ? "bg-primary-50" : "bg-gray-100"
                          )}
                        >
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            {MEAL_LABELS[mealType]}
                          </p>
                          {mealForType ? (
                            <p className="text-sm font-medium">
                              {Math.round(mealCalories || 0)}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-500">-</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weekly Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const startStr = weekDates[0].toISOString().split("T")[0];
            const endStr = weekDates[6].toISOString().split("T")[0];
            const weekMeals = meals.filter(
              (m) => m.date >= startStr && m.date <= endStr
            );

            if (weekMeals.length === 0) {
              return (
                <p className="text-center text-gray-500 py-4">
                  No meals logged this week
                </p>
              );
            }

            const totalNutrients = calculateDailyNutrients(weekMeals);
            const daysWithMeals = new Set(weekMeals.map((m) => m.date)).size;
            const avgCalories = (totalNutrients["1008"] || 0) / daysWithMeals;

            return (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-2xl font-bold">
                    {Math.round(totalNutrients["1008"] || 0)}
                  </p>
                  <p className="text-xs text-gray-500">Total Calories</p>
                </div>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-2xl font-bold">{Math.round(avgCalories)}</p>
                  <p className="text-xs text-gray-500">Avg/Day</p>
                </div>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-2xl font-bold">{weekMeals.length}</p>
                  <p className="text-xs text-gray-500">Total Meals</p>
                </div>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-2xl font-bold">{daysWithMeals}/7</p>
                  <p className="text-xs text-gray-500">Days Tracked</p>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-48" />
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
