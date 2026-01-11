"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Utensils, Moon, Activity, Pill, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/charts/progress-ring";
import { NutrientBar } from "@/components/charts/nutrient-bar";
import { useMealsStore, calculateDailyNutrients } from "@/lib/stores/meals";
import { useSleepStore, calculateDuration } from "@/lib/stores/sleep";
import { useSymptomsStore } from "@/lib/stores/symptoms";
import { useSupplementsStore } from "@/lib/stores/supplements";
import { useProfileStore } from "@/lib/stores/profile";
import { TRACKED_NUTRIENTS } from "@/lib/api/usda";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const { getMealsByDate } = useMealsStore();
  const { getSleepByDate, getSleepStats } = useSleepStore();
  const { getLogsByDate: getSymptomsByDate } = useSymptomsStore();
  const { getLogsByDate: getSupplementsByDate } = useSupplementsStore();
  const { profile, initProfile, getAdjustedGoals } = useProfileStore();

  useEffect(() => {
    setMounted(true);
    initProfile();
  }, [initProfile]);

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  const todaysMeals = getMealsByDate(today);
  const todaysSleep = getSleepByDate(today);
  const todaysSymptoms = getSymptomsByDate(today);
  const todaysSupplements = getSupplementsByDate(today);
  const sleepStats = getSleepStats(7);
  const goals = getAdjustedGoals();

  const dailyNutrients = calculateDailyNutrients(todaysMeals);
  const calories = dailyNutrients["1008"] || 0;
  const protein = dailyNutrients["1003"] || 0;
  const carbs = dailyNutrients["1005"] || 0;
  const fat = dailyNutrients["1004"] || 0;

  const sleepDuration = todaysSleep
    ? calculateDuration(todaysSleep.bedtime, todaysSleep.wakeTime)
    : 0;
  const sleepHours = sleepDuration / 60;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Today&apos;s Summary</h1>
          <p className="text-gray-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/food/log">
          <Button size="icon" className="rounded-full h-12 w-12 shadow-lg">
            <Plus className="w-6 h-6" />
          </Button>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <ProgressRing
              value={calories}
              max={goals.calories}
              size={80}
              strokeWidth={8}
              label={Math.round(calories).toString()}
              sublabel="kcal"
            />
            <p className="mt-2 text-sm font-medium text-gray-500">Calories</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <ProgressRing
              value={protein}
              max={goals.protein}
              size={80}
              strokeWidth={8}
              label={`${Math.round(protein)}g`}
              sublabel={`/${goals.protein}g`}
              color="stroke-blue-500"
            />
            <p className="mt-2 text-sm font-medium text-gray-500">Protein</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <ProgressRing
              value={sleepHours}
              max={8}
              size={80}
              strokeWidth={8}
              label={sleepHours.toFixed(1)}
              sublabel="hours"
              color="stroke-sleep-500"
            />
            <p className="mt-2 text-sm font-medium text-gray-500">Sleep</p>
          </CardContent>
        </Card>
      </div>

      {/* Macros Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Macros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NutrientBar
            name="Protein"
            value={protein}
            max={goals.protein}
            unit="g"
          />
          <NutrientBar
            name="Carbohydrates"
            value={carbs}
            max={goals.carbs}
            unit="g"
          />
          <NutrientBar
            name="Fat"
            value={fat}
            max={goals.fat}
            unit="g"
          />
        </CardContent>
      </Card>

      {/* Micronutrient Highlights */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Nutrient Highlights</CardTitle>
            <Link href="/food" className="text-sm text-primary-600 hover:underline">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <NutrientBar
            name="Iron"
            value={dailyNutrients["1089"] || 0}
            max={18}
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
            name="Calcium"
            value={dailyNutrients["1087"] || 0}
            max={1000}
            unit="mg"
            showWarning
          />
          <NutrientBar
            name="Fiber"
            value={dailyNutrients["1079"] || 0}
            max={goals.fiber}
            unit="g"
            showWarning
          />
        </CardContent>
      </Card>

      {/* Today's Meals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              Today&apos;s Meals
            </CardTitle>
            <Link href="/food">
              <Button variant="ghost" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todaysMeals.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No meals logged today</p>
              <Link href="/food/log">
                <Button variant="outline" size="sm" className="mt-2">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Meal
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {todaysMeals.map((meal) => {
                const mealCalories = meal.items.reduce((sum, item) => {
                  const cal = item.food.nutrients.find((n) => n.nutrientId === "1008");
                  return sum + (cal?.amount || 0) * item.servings;
                }, 0);

                return (
                  <li
                    key={meal.id}
                    className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                  >
                    <div>
                      <p className="font-medium capitalize">{meal.mealType}</p>
                      <p className="text-sm text-gray-500">
                        {meal.items.length} item{meal.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium">
                      {Math.round(mealCalories)} kcal
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/sleep">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sleep-100 flex items-center justify-center">
                <Moon className="w-5 h-5 text-sleep-600" />
              </div>
              <div>
                <p className="font-medium">Sleep</p>
                <p className="text-sm text-gray-500">
                  {todaysSleep ? `${sleepHours.toFixed(1)}h logged` : "Not logged"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/symptoms">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Symptoms</p>
                <p className="text-sm text-gray-500">
                  {todaysSymptoms.length} logged today
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/supplements">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Pill className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Supplements</p>
                <p className="text-sm text-gray-500">
                  {todaysSupplements.length} taken today
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-lg">⚙️</span>
              </div>
              <div>
                <p className="font-medium">Settings</p>
                <p className="text-sm text-gray-500">
                  {profile?.conditions[0] !== "none"
                    ? profile?.conditions.length + " conditions"
                    : "Set up profile"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}
