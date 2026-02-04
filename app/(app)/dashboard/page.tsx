"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Utensils, Moon, Activity, Pill, ChevronRight, Settings, UtensilsCrossed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { ProgressRing } from "@/components/charts/progress-ring";
import { NutrientBar } from "@/components/charts/nutrient-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { useMealsStore, calculateDailyNutrients } from "@/lib/stores/meals";
import { useSleepStore, calculateDuration } from "@/lib/stores/sleep";
import { useSymptomsStore } from "@/lib/stores/symptoms";
import { useSupplementsStore } from "@/lib/stores/supplements";
import { useEffectiveGoals, useUserHealthConditions } from "@/lib/hooks";
import { localDateISO } from "@/lib/utils/dates";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const today = localDateISO();

  const { getMealsByDate } = useMealsStore();
  const { getSleepByDate, getSleepStats } = useSleepStore();
  const { getLogsByDate: getSymptomsByDate } = useSymptomsStore();
  const { getLogsByDate: getSupplementsByDate } = useSupplementsStore();
  const { goals } = useEffectiveGoals();
  const { data: userConditions = [] } = useUserHealthConditions();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <DashboardSkeleton />;
  }

  const todaysMeals = getMealsByDate(today);
  const todaysSleep = getSleepByDate(today);
  const todaysSymptoms = getSymptomsByDate(today);
  const todaysSupplements = getSupplementsByDate(today);
  const sleepStats = getSleepStats(7);

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
      <PageHeader
        title="Today's Summary"
        description={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        action={
          <Link href="/food/log">
            <Button size="icon-lg" aria-label="Add meal">
              <Plus className="w-6 h-6" />
            </Button>
          </Link>
        }
      />

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
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Calories</p>
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
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Protein</p>
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
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Sleep</p>
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
            <Link
              href="/food?tab=nutrients"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 font-medium"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <NutrientBar
            name="Iron"
            value={dailyNutrients["1089"] || 0}
            max={goals.customNutrients?.["1089"] ?? 18}
            unit="mg"
            showWarning
          />
          <NutrientBar
            name="Vitamin D"
            value={dailyNutrients["1114"] || 0}
            max={goals.customNutrients?.["1114"] ?? 20}
            unit="mcg"
            showWarning
            info="Vitamin D supports calcium absorption. Many people pair it with vitamin K2 (especially MK-7) to support normal calcium utilization (e.g., bones vs soft tissues). Evidence is mixed; if you use blood thinners or have medical conditions, check with your clinician."
          />
          <NutrientBar
            name="Calcium"
            value={dailyNutrients["1087"] || 0}
            max={goals.customNutrients?.["1087"] ?? 1000}
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
              <Button variant="ghost" size="icon-sm" aria-label="View all meals">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todaysMeals.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No meals logged"
              description="Start tracking your nutrition by logging your first meal of the day."
              action={{
                label: "Log a meal",
                href: "/food/log",
              }}
              className="py-6"
            />
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
                    className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <div>
                      <p className="font-medium capitalize text-slate-900 dark:text-slate-100">{meal.mealType}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {meal.items.length} item{meal.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
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
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-sleep-100 dark:bg-sleep-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Moon className="w-5 h-5 text-sleep-600 dark:text-sleep-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Sleep</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {todaysSleep ? `${sleepHours.toFixed(1)}h logged` : "Not logged"}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/symptoms">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Symptoms</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {todaysSymptoms.length} logged today
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/supplements">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Pill className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Supplements</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {todaysSupplements.length} taken today
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <CardContent className="pt-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Settings</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {userConditions.length > 0
                    ? `${userConditions.length} selections`
                    : "Set goals & context"}
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
      <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
        ))}
      </div>
      <div className="h-52 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
      <div className="h-52 bg-slate-100 dark:bg-slate-800 rounded-[28px] animate-pulse" />
    </div>
  );
}
